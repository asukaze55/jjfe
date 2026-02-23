# JJFE

[Jujutsu (jj)](https://github.com/jj-vcs/jj) をラップするアプリケーションです。
差分をサイドバイサイド表示で確認できます。

あらかじめ Jujutsu をインストールし、jj.exe にパスを通しておいてください。

## jjfe.exe

[Tauri](https://v2.tauri.app/) でパッケージングした Windows 実行ファイルです。
ダブルクリックで起動後、インプットボックスにリポジトリのパスを入力してください。
"Log" の下のセレクトボックスでチェンジを選択すると、そのチェンジの情報が表示されます。

![スクリーンショット](https://www.asukaze.net/image/2026/jjfe_20260223.png)

## Web サーバー

下記の手順で Web サーバーとしても実行できます。
アクセス認証等はしないので外部からのアクセスを受け付けないように気をつけてください。

1. Jujutsu をインストール
2. [Node.js](https://nodejs.org/) をインストール
3. JJFE のソースコードをダウンロード
4. `npm install`
5. `npm start`
6. `http://localhost:7474/` を開く
