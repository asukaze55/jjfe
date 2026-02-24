# JJFE

[Jujutsu (jj)](https://github.com/jj-vcs/jj) を GUI で操作するためのアプリケーションです。
差分をサイドバイサイド表示で確認できます。

## インストール方法・使い方 

あらかじめ Jujutsu をインストールし、jj.exe にパスを通しておいてください。

https://github.com/asukaze55/jjfe/releases から jjfe_0.1.0.zip をダウンロードし、適当なフォルダに展開してください。
中の jjfe.exe が Windows 用の実行ファイルです。

ダブルクリックで起動後、インプットボックスにリポジトリのパスを入力してください。
"Log" の下のセレクトボックスでチェンジを選択すると、そのチェンジの情報が表示されます。

"Describe" "Edit" "New" "Squash" などの基本的なコマンドもボタンクリックで実行可能です。
必要なボタンがない時はコマンドラインに戻ってください。

開発環境として使っている [Tauri](https://v2.tauri.app/) はクロスプラットフォーム対応ですが、今のところ Windows 用以外のバイナリは用意していません。

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
