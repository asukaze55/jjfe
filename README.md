# JJFE

[Jujutsu (jj)](https://github.com/jj-vcs/jj) をラップする Web フロントエンドです。
差分をサイドバイサイド表示で確認できます。

HTTP サーバーとして動作しますが、アクセス認証等はしないので外部からのアクセスを受け付けないように気をつけてください。

## インストール

1. Jujutsu をインストール
2. [Node.js](https://nodejs.org/) をインストール
3. JJFE のソースコードをダウンロード
4. `npm install`
5. `npm run build`

## 実行方法

1. `npm start`
2. `http://localhost:7474/` を開く
3. インプットボックスにリポジトリのパスを入力
4. "Log" の下のセレクトボックスでチェンジを選択すると、そのチェンジの情報が表示される。

![スクリーンショット](https://www.asukaze.net/image/2026/jjfe_20260215.png)
