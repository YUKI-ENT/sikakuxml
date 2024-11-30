const express = require('express');
const router = express.Router();
const { create } = require('xmlbuilder2');
const xss = require('xss');

const fs = require('fs').promises; // 非同期ファイル操作用
const path = require('path');
const iconv = require('iconv-lite'); // Shift_JISエンコード用
const OQS_XML_PREFIX = 'OQSsiquc01res_face_';

// 設定ファイルの読み込み
// config.jsonの絶対パスを計算
const defaultConfig = {
  filePath: "/mnt",
  MedicalInstitutionCode: "0000"
};
const configPath = path.resolve(__dirname, '../config.json');
let config;

const loadConfig = async () => {
  let readconfig;
  try {
    // 設定ファイルが存在するか確認
    await fs.access(configPath);
    console.log('設定ファイルが見つかりました。読み込んでいます...');
    
    // ファイル内容を読み込む
    const data = await fs.readFile(configPath, 'utf8');
    readconfig = JSON.parse(data);
  } catch (err) {
    if (err.code === 'ENOENT') {
      console.log('設定ファイルが存在しません。初期値で作成します。');

      // 初期値でファイルを作成
      await fs.writeFile(configPath, JSON.stringify(defaultConfig, null, 2), 'utf8');
      readconfig = defaultConfig;
    } else {
      // それ以外のエラーはログを出力して再スロー
      console.error('設定ファイルの読み込み中にエラーが発生しました:', err);
      throw err;
    }
  }
  return readconfig;
};
(async () => {
  try {
    config = await loadConfig();
    // console.log('現在の設定:', config);
  } catch (err) {
    console.error('エラーが発生しました:', err);
  }
})();


// 元号を西暦に変換する関数
const convertJapaneseDateToWestern = (japaneseDate) => {
  const eras = {
    昭和: 1925, // 昭和元年は1926年
    平成: 1988, // 平成元年は1989年
    令和: 2018, // 令和元年は2019年
  };

  // 和暦の形式にマッチさせる正規表現
  const match = japaneseDate.match(/(昭和|平成|令和)(\d{1,2})年(\d{1,2})月(\d{1,2})日/);

  if (match) {
    const [, era, year, month, day] = match;
    const westernYear = eras[era] + parseInt(year, 10); // 西暦の年を計算
    return `${westernYear}${month.padStart(2, '0')}${day.padStart(2, '0')}`; // YYYYMMDD形式に変換
  }

  // 和暦以外の場合、入力をそのまま返す
  return japaneseDate.replace(/\D/g, ''); // 数字以外の文字を削除
};

// 日付を西暦形式（YYYYMMDD）に変換するための関数
const convertIfJapaneseDate = (date) => {
  // 和暦の場合、変換を行う
  return date ? convertJapaneseDateToWestern(date.replace(/-/g, '')) : '';
};

// 現在の日付と時刻を"YYYYMMDDHHmmss"の形式で取得
const getFormattedDate = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0'); // 月は0から始まるので+1
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');

  return `${year}${month}${day}${hours}${minutes}${seconds}`;
};

// TextDataからkey valueを分離
const parseTextData = (text) => {
  const lines = text.split('\n'); // テキストを行ごとに分割
  const data = {}; // 解析結果を格納するオブジェクト
  let currentSection = null; // 現在のセクション（例: 裏面記載情報）

  lines.forEach((line) => {
    let trimmedLine = line.trim(); // 1. トリムする（前後の空白を削除）
    if (!trimmedLine) return; // 空行は無視

    // 2. タブ（\t）とコロン（:、：）をすべて半角スペースに置換
    trimmedLine = trimmedLine.replace(/[\t：:]/g, ' ');

    // セクションの切り替え
    if (trimmedLine.includes('裏面記載情報')) {
      currentSection = '裏面記載情報';
      return;
    }
    if (trimmedLine.includes('限度額適用認定証')) {
      currentSection = '限度額適用認定証';
      return;
    }

    // 3. 最初に現れる半角スペースでkeyとvalueに分離
    const firstSpaceIndex = trimmedLine.indexOf(' '); // 最初の半角スペースの位置
    if (firstSpaceIndex === -1) return; // 半角スペースが見つからない場合は処理しない

    const key = trimmedLine.substring(0, firstSpaceIndex).trim(); // キー
    const value = trimmedLine.substring(firstSpaceIndex).trim(); // 値

    // セクションに格納
    if (currentSection) {
      if (!data[currentSection]) data[currentSection] = {};
      data[currentSection][key] = value;
    } else {
      data[key] = value;
    }
  });

  // 西暦に変換
  if (data['生年月日']) data['生年月日'] = convertIfJapaneseDate(data['生年月日']);
  if (data['確認日']) data['確認日'] = convertIfJapaneseDate(data['確認日']);
  if (data['有効開始日']) data['有効開始日'] = convertIfJapaneseDate(data['有効開始日']);
  if (data['有効終了日']) data['有効終了日'] = convertIfJapaneseDate(data['有効終了日']);
  if (data['資格取得年月日']) data['資格取得年月日'] = convertIfJapaneseDate(data['資格取得年月日']);
  if (data['限度額適用認定証']?.['有効開始年月日'])
    data['限度額適用認定証']['有効開始年月日'] = convertIfJapaneseDate(data['限度額適用認定証']['有効開始年月日']);
  if (data['限度額適用認定証']?.['有効終了年月日'])
    data['限度額適用認定証']['有効終了年月日'] = convertIfJapaneseDate(data['限度額適用認定証']['有効終了年月日']);

  return data; // 解析結果を返す
};

//オブジェクトが適性か判断する関数  
function hasRequiredKeys(obj) {
  // 必要なキーのリスト
  const requiredKeys = ['氏名', 'フリガナ', '生年月日', '記号', '番号', '保険者番号'];

  // 全てのキーがオブジェクトに含まれているか判定
  return requiredKeys.every(key => obj.hasOwnProperty(key));
}

// XMLを生成する関数
const generateXml = (data) => {
  const xmlObj = {
    XmlMsg: {
      MessageHeader: {
        ProcessExecutionTime: getFormattedDate(),
        CharacterCodeIdentifier: '1',
        SegmentOfResult: '1',
        QualificationConfirmationDate: data['確認日']?.replace(/-/g, '') || new Date().toISOString().slice(0, 10).replace(/-/g, ''),
        ReferenceClassification: '1',
        ArbitraryFileIdentifier: 'B4u_QfxBNjMCL4w=',
        MedicalInstitutionCode: config.MedicalInstitutionCode,
      },
      MessageBody: {
        ResultList: {
          ResultOfQualificationConfirmation: {
            Address: data['住所'] || '', // 今回は省略してもOK
            Name: data['氏名'],
            NameKana: data['フリガナ'],
            Birthdate: data['生年月日'],
            Sex1: data['性別'] === '男' ? '1' : '2',
            InsuredCardSymbol: data['記号'],
            InsuredIdentificationNumber: data['番号'],
            InsuredBranchNumber: data['枝番'],
            QualificationDate: data['資格取得年月日'],
            InsuredCardValidDate: data['有効開始日'],
            InsuredCardExpirationDate: data['有効終了日'],
            InsurerNumber: data['保険者番号'],
            InsurerName: data['保険者名'],
            InsuredName: data['被保険者氏名'],
            // SpecificHealthCheckupsInfoConsTime: '20241127122900',
            // DiagnosisInfoConsFlg: '1',
            // SpecificHealthCheckupsInfoAvailableTime: '20241128122900',
            PersonalFamilyClassification: data['本人・家族の別'] === '本人' ? '1' : '2',
            // SpecificDiseasesCertificateRelatedConsFlg: '0',
            // OperationInfoConsFlg: '1',
            // DiagnosisInfoAvailableTime: '20241128122900',
            // LimitApplicationCertificateRelatedConsTime: '20241127122900',
            // OperationInfoAvailableTime: '20241128122900',
            // PharmacistsInfoAvailableTime: '20241128122900',
            // PharmacistsInfoConsTime: '20241127122900',
            // PharmacistsInfoConsFlg: '1',
            // InsuredCertificateIssuanceDate: '20241101',
            LimitApplicationCertificateRelatedInfo: {
              LimitApplicationCertificateClassification: '01',
              LimitApplicationCertificateClassificationFlag: 'A01',
              LimitApplicationCertificateValidStartDate: data['限度額適用認定証']?.['有効開始年月日'],
              LimitApplicationCertificateValidEndDate: data['限度額適用認定証']?.['有効終了年月日'],
            },
          },
        },
        ProcessingResultStatus: '1',
        QualificationValidity: '1',
      },
    },
  };

  /// XML宣言を設定し、ルート要素を構築
  const root = create()
  .dec({ version: '1.0', encoding: 'Shift_JIS', standalone: 'no' }) // XML宣言を追加
  .ele(xmlObj); // ルート要素を追加

  // XML文字列を整形して生成
  const xmlUtf8 = root.end({ prettyPrint: true });

  // Shift_JISにエンコード
  return xmlUtf8;
};

// XMLを非同期でファイルに保存する関数
const saveXmlToFile = async (encodedXml) => {
  try {
    const formattedDate = getFormattedDate(); // 現在の日付と時刻を取得
    const filename = OQS_XML_PREFIX + `${formattedDate}.xml`; // ファイル名を設定
    const directoryPath = path.resolve(config.filePath); // 設定ファイルからディレクトリパスを取得
    const filePath = path.join(directoryPath, filename); // フルパスを生成

    // ディレクトリが存在しない場合は作成
    await fs.mkdir(directoryPath, { recursive: true });

    // Shift_JISにエンコード
    const xmlShiftJis = iconv.encode(encodedXml, 'Shift_JIS');
    // ファイルに書き込み
    await fs.writeFile(filePath, xmlShiftJis);
    console.log(`XMLファイルが保存されました: ${filePath}`);
    return `XMLファイルが保存されました: ${filePath}`;
  } catch (err) {
    console.error('XMLファイルの保存に失敗しました:', err);
    return 'XMLファイルの保存に失敗しました';
  }
};

// GET / ルート
router.get('/', (req, res) => {
  res.render('index');
});

// POST /convert-xml ルート
router.post('/convert-xml', async (req, res) => {
  // サニタイズ処理
  const sanitizedTextData = xss(req.body.textData || '', { whiteList: {} }); // 全タグを無効化
  if (!sanitizedTextData || typeof sanitizedTextData !== 'string') {
    return res.status(400).json({ error: 'Invalid input: textData must be a non-empty string.' });
  }
  
  let xmlOutput;
  const parsedData = parseTextData(sanitizedTextData);

  if(hasRequiredKeys(parsedData)){
    console.log('正しい保険情報を受け取りました。xml変換して出力します');
    xmlOutput = generateXml(parsedData);
    console.log(parsedData);

    const saveresult = await saveXmlToFile(xmlOutput);

    xmlOutput = saveresult + '\n\n' + xmlOutput;
  } else{
    console.log('保険情報が正しくありません');
    xmlOutput = '入力されたデータのフォーマットが正しくありませんでしたので、処理を中止しました';
  }
  res.header('Content-Type', 'application/xml');
  res.send(xmlOutput);
});

// 設定ページのGETルート
router.get('/settings', async (req, res) => {
  try {
    // delete require.cache[require.resolve(configPath)];
    config = await loadConfig(); // 設定ファイルを読み込み

    res.render('settings', { config });
  } catch (err) {
    console.error('設定ファイルの読み込みに失敗しました:', err);
    res.status(500).send('設定ファイルの読み込みに失敗しました。');
  }
});

// 設定ページのPOSTルート
router.post('/settings', async (req, res) => {
  const { filePath, MedicalInstitutionCode } = req.body;
  try {
    const updatedConfig = { filePath, MedicalInstitutionCode };
    await fs.writeFile(configPath, JSON.stringify(updatedConfig, null, 2), 'utf8'); // 設定を保存
    // requireキャッシュをクリア
    delete require.cache[require.resolve(configPath)];
    config = await loadConfig();
    
    res.redirect('/settings'); // 設定ページを再表示
    console.log('設定を保存しました', updatedConfig);
    
  } catch (err) {
    console.error('設定の保存に失敗しました:', err);
    res.status(500).send('設定の保存に失敗しました。');
  }
});


module.exports = router;
