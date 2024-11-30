# マイナ資格確認アプリの出力結果をxml化するWebアプリ

マイナ資格確認アプリで取得した保険情報をxmlに変換して出力するWebアプリです。node.jsが動く環境で動きます。

## 動作概要のデモ
[![YouTube](https://img.youtube.com/vi/cRvjd4d5uAQ/0.jpg)](https://youtu.be/cRvjd4d5uAQ)


## 動作環境
- オンライン資格確認端末と同一セグメントか、オンライン資格確認のOQSフォルダに書き込めるネットワーク上で、マイナ資格確認アプリが動作するスマートフォンからもTCPポート4000番でアクセスできるPC

## Node.jsを導入して実行する場合
- node.js v20以上
- Windowsの場合は、https://nodejs.org/en からダウンロードしてインストールしてください。
- sikakuxml/ 以下を任意のフォルダに解凍
- コマンドプロンプトから上記フォルダに移動し、npm start を実行
- デフォルトで4000番ポートで起動します
- ポートを変えたいときは、.envを編集してください。
- http://アドレス:4000/ でアクセスできます。
- xmlを出力するフォルダを設定タブから設定してください

## Docker導入ガイド (Windows版)
### 1. Docker Desktopのダウンロードとインストール
1. **公式サイトからDocker Desktopをダウンロード**
   - URL: [https://www.docker.com/products/docker-desktop](https://www.docker.com/products/docker-desktop)

2. **インストール**
   - ダウンロードしたインストーラーを実行。
   - WSL 2 または Hyper-V を有効化（推奨）。
   - インストール後にPCを再起動。

3. **初期設定**
   - Docker Desktopを起動し、Dockerアカウントでログイン。
   - 必要に応じてWSL 2バックエンドを有効化。

### 2. Dockerイメージの実行
- [https://github.com/YUKI-ENT/sikakuxml/releases](https://github.com/YUKI-ENT/sikakuxml/releases) からdocker_sikakuxml.zipをダウンロード
- 任意のフォルダに解凍します。
- Docker desktopの右下「Terminal」をクリックし、Terminalウインドウを呼び出します。（コマンドプロンプトでもOK）
- 解凍したフォルダに移動し、
     ```PS
     docker load -i sikakuxml.tar
     
- Docker desktopのImagesタブにsikakuxmlが表示されます。
- コンテナを起動します。このとき、xmlを出力するフォルダとコンテナの/mntをリンクさせます。例えば\\SIKAKUPC\OQS\faceに出力したいときは、以下のコマンドになります。
     ```PS
      docker run -d -name sikakuxml-dyna -v \\SIKAKUPC\OQS\face:/mnt -p 4000:4000 --restart unless-stopped sikakuxml

- Docker desktopのContainersタブにコンテナが実行されているのが表示されていると思います。コマンドプロンプトから以下のコマンドでも確認できます。
     
     `docker ps `
- http://(アドレス):4000 でアクセスできることを確認します。Dockerの場合は、アプリ設定タブのxml出力フォルダは/mntのままにしておいて下さい。     

