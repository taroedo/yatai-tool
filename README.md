# 篠四 イベント会計ポータル

GitHub Pagesのトップページから共通アクセスコードを入力し、イベント別のレジ画面・管理画面・UI検証ページを開く構成です。

## 初期コード

- ポータルのアクセスコード：`6428`
- 盆踊り管理・監視画面の管理PIN：`4826`
- オータムフェス管理・監視画面の管理PIN：`4826`

どちらも静的JavaScript内にある簡易コードです。本格的な認証ではなく、関係者以外の誤操作を減らすために使用します。

## フォルダー構成

```text
index.html                  共通ログイン・イベント選択
register.html               旧レジURLから盆踊りレジへ移動
admin.html                  旧管理URLから盆踊り管理へ移動
ui-test.html                盆踊りUI検証ページ
ui-test-autumn.html         オータムフェスUI検証ページ
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
  index.html                オータムフェス入口
  register.html             オータムフェスレジ
  admin.html                オータムフェス管理・監視
  firebase-config.js        Firebase・年度・管理PIN設定
  register.js / admin.js / common.js / autumn.css
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
  accessCode: "6428",
  storageKey: "shino4-yatai-portal-access-v2",
  accessHours: 12
});
```

入口通過後は同じブラウザに12時間保存されます。「ログアウト」を押すとすぐに解除されます。

## 盆踊りシステム

現在のFirebaseプロジェクト、イベントID、管理PINを`bonodori/firebase-config.js`へ設定済みです。既存の盆踊りデータ保存先を引き続き使用します。

- レジ：`/bonodori/register.html`
- 管理・監視：`/bonodori/admin.html`
- 旧URL `/register.html` と `/admin.html` は、新URLへ自動移動します。

Firebaseのルールは同梱の`database.rules.json`を使用します。テストデータ初期化機能を追加した版では、Firebase側のルールも更新してください。

### テストデータ初期化

管理画面の最下部にある「テストデータをすべて削除」から、現在の盆踊りイベント内のテストデータを初期化できます。

- 売上・取消・営業日・締め情報・監査ログ・接続記録を削除
- 削除前に全取引CSVを自動保存
- 営業中またはレジ接続中は実行不可
- 管理PINの再入力と確認文字「全削除」が必要
- Firebase設定、イベントID、管理PIN、ポータル設定は削除しない

この機能を使用する前に、更新版の`database.rules.json`をFirebase Realtime Databaseのルールへ反映してください。古いルールのままでは、売上・監査ログの削除が拒否されます。

レジ端末に未送信データが残っていると、初期化後の再接続時に取引が再送信されます。各レジで「未送信 0件」を確認し、レジ画面を閉じてから初期化してください。

## UI検証ページ

`ui-test.html`と`ui-test-autumn.html`はFirebaseを読み込まず、データをページ内変数だけで管理します。

- 商品数量、合計、預かり金、お釣りの確認
- 会計と直前取消の確認
- 管理画面や別端末への送信なし
- 再読み込みでデータ初期化
- 盆踊り版は2商品、オータムフェス版は6商品と「+50円」に対応

## 売上CSV出力

管理画面の「売上CSV出力」は営業前・営業中・終了後のすべてで表示されます。保存されている全日程・全レジの会計と取消を、発生時刻の古い順で1つのCSVに出力します。取引が0件の場合はボタンが無効になります。

## 本番レジのスマホUI

UI検証で確認したスマホ向け操作改善を盆踊りレジへ反映しています。

- 預かり金ボタンを拡大
- 預かり金の「クリア」を追加
- 商品の「−」を小さく、「＋」を大きく調整
- 合計金額・預かり金額・お釣りを32pxに統一
- 預かり金額を右寄せ
- 会計ボタンを少し下へ移動

## オータムフェスシステム

盆踊りと同じFirebaseプロジェクトを使いますが、イベントIDを分けているため売上データは混ざりません。

- レジ：`/autumn/register.html`
- 管理・監視：`/autumn/admin.html`
- フランク：100円
- 焼きそば：200円
- チョコバナナ：100円
- 焼き菓子①：100円
- 焼き菓子②：150円
- ドリンク：100円

管理画面では6商品の販売数量、レジ別売上、担当別会計件数、取消、営業締め、全期間CSV、テストデータ初期化を利用できます。

Firebaseでは盆踊りと異なるイベントIDを設定し、データを分離しています。

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
