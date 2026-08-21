# 篠四 イベント会計ポータル

GitHub Pagesのトップページから共通アクセスコードを入力し、イベント別のレジ画面・管理画面・UI検証ページを開く構成です。

## 初期コード

- ポータルのアクセスコード：`6482`
- 盆踊り管理・監視画面の管理PIN：`4826`

どちらも静的JavaScript内にある簡易コードです。本格的な認証ではなく、関係者以外の誤操作を減らすために使用します。

## フォルダー構成

```text
index.html                  共通ログイン・イベント選択
register.html               旧レジURLから盆踊りレジへ移動
admin.html                  旧管理URLから盆踊り管理へ移動
ui-test.html                Firebaseへ送信しないUI検証ページ
database.rules.json         Firebase Realtime Databaseルール

shared/
  portal-config.js          アクセスコードと保持時間
  portal.js                 ポータル画面の処理
  access-guard.js           各ページの入口確認
  portal.css                ポータル共通デザイン

bonodori/
  register.html             盆踊りレジ
  admin.html                盆踊り管理・監視
  firebase-config.js        Firebase・年度・管理PIN設定
  register.js / admin.js / common.js / styles.css

autumn/
  index.html                オータムフェス準備ページ
```

## GitHub Pagesへの更新

1. ZIPを展開します。
2. `yatai-event-portal`フォルダーの**中身すべて**をGitHubリポジトリの最上位へアップロードします。
3. 同名ファイルの上書きを確認してコミットします。
4. GitHub PagesのトップURLを開きます。

例：`https://taroedo.github.io/yatai-tool/?v=1`

`bonodori`・`autumn`・`shared`のフォルダー構造を維持してください。ZIPファイル自体をGitHubへ置いても、サイトは更新されません。

## 入口コードの変更

`shared/portal-config.js`を編集します。

```js
window.YATAI_PORTAL_CONFIG = Object.freeze({
  accessCode: "6482",
  storageKey: "shino4-yatai-portal-access-v1",
  accessHours: 12
});
```

入口通過後は同じブラウザに12時間保存されます。「ログアウト」を押すとすぐに解除されます。

## 盆踊りシステム

現在のFirebaseプロジェクト、イベントID、管理PINを`bonodori/firebase-config.js`へ設定済みです。既存の盆踊りデータ保存先を引き続き使用します。

- レジ：`/bonodori/register.html`
- 管理・監視：`/bonodori/admin.html`
- 旧URL `/register.html` と `/admin.html` は、新URLへ自動移動します。

Firebaseのルールは既存の`database.rules.json`を継続して使用できます。

## UI検証ページ

`ui-test.html`はFirebaseを読み込まず、データをページ内変数だけで管理します。

- 商品数量、合計、預かり金、お釣りの確認
- 会計と直前取消の確認
- 管理画面や別端末への送信なし
- 再読み込みでデータ初期化

## オータムフェスの追加時

販売商品、単価、開催日数が決まったら、`autumn`フォルダーへレジ・管理ファイルを追加します。Firebaseでは盆踊りと異なるイベントIDを設定し、データを分離します。

例：

```text
events/
  shino4-bonodori-2026-xxxxxxxx/
  shino4-autumn-2026-xxxxxxxx/
```

翌年は新しいイベントIDを作ることで、前年データを残したまま使用できます。

## セキュリティ上の注意

- GitHub Pagesだけでは、ページやコードを完全に非公開にはできません。
- ポータルコードと管理PINは、誤操作防止用の簡易機能です。
- Firebase Authenticationは使用していません。
- Firebaseへサービスアカウント秘密鍵やAdmin SDKの秘密鍵を置かないでください。
- 本番前にレジ2台と管理端末で、会計・取消・CSV・営業締めを通しで確認してください。
