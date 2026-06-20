# セットアップ・起動ガイド

**AI NEON BLASTER**（動的難易度調整シューティング）をローカルで動かす手順です。

## 概要

| 項目 | 内容 |
|------|------|
| アプリ本体 | `AI_Shuting/client/`（React 19 + Vite 6） |
| 実行形態 | ブラウザのみ（**バックエンド・DB 不要**） |
| 難易度調整（DDA） | クライアント内で完結 |

旧版の `AI_Shuting/index.html` / `game.js` / `style.css` は参照用のレガシーです。**通常は `client` を使ってください。**

## 必要条件

| ツール | 推奨バージョン |
|--------|----------------|
| [Node.js](https://nodejs.org/) | **18 以上**（Vite 6 の要件） |
| [pnpm](https://pnpm.io/) | **9 以上**（`pnpm-lock.yaml` で管理） |
| ブラウザ | Chrome / Edge / Firefox など最新版 |

`npm` でも動きますが、このリポジトリでは **pnpm を前提** にしています。

### pnpm の導入（未インストールの場合）

```bash
corepack enable
corepack prepare pnpm@latest --activate
pnpm -v
```

## ディレクトリ構成

```
difficulty_adjustment_AI/
└── AI_Shuting/
    ├── client/                 # ← ここで開発・起動
    │   ├── package.json
    │   ├── pnpm-lock.yaml
    │   ├── src/                # React UI・ゲームエンジン・DDA
    │   └── dist/               # build 出力（git 管理外）
    ├── docs/
    │   ├── setup.md            # 本ドキュメント
    │   └── difficulty-adjustment.md
    ├── index.html              # レガシー（未使用）
    ├── game.js
    └── style.css
```

## 初回セットアップ

### 1. クライアントへ移動

```bash
cd AI_Shuting/client
```

Windows でリポジトリが `C:\Users\...` にある場合、WSL からは次のようにパスを置き換えます。

```bash
cd /mnt/c/Users/kotet/Documents/program-work/difficulty_adjustment_AI/AI_Shuting/client
```

### 2. 依存パッケージをインストール

```bash
pnpm install
```

**WSL 利用時（推奨）**  
Windows 上のフォルダを WSL から触る場合、ログインシェル経由だと `pnpm` / `node` の PATH が通りやすいです。

```bash
wsl bash -lic 'cd /mnt/c/Users/kotet/Documents/program-work/difficulty_adjustment_AI/AI_Shuting/client && pnpm install'
```

（パスは自分の環境に合わせて変更してください。）

### 3. 開発サーバーを起動

```bash
pnpm dev
```

ターミナルに表示される URL（通常は **http://localhost:5173**）をブラウザで開きます。

WSL から起動する例:

```bash
wsl bash -lic 'cd /mnt/c/Users/kotet/Documents/program-work/difficulty_adjustment_AI/AI_Shuting/client && pnpm dev'
```

### 4. ゲームの開始

1. 画面の **SYSTEM INITIALIZE** をクリック
2. キャンバスにフォーカスがある状態で操作（クリックでフォーカス可能）

## 操作

| 入力 | 動作 |
|------|------|
| `W` / `A` / `S` / `D` または矢印キー | 移動 |
| `Space`（長押し可） | 射撃 |

プレイ中は右側のパネルで DDA の状態（弾数・弾速・スポーン間隔など）を確認できます。ゲームオーバー後は難易度の推移グラフが表示されます。

## 本番ビルドとプレビュー

静的ファイルとして配布・確認する場合:

```bash
cd AI_Shuting/client
pnpm build      # dist/ に出力
pnpm preview    # ビルド結果をローカルで配信
```

`preview` の URL もターミナルに表示されます（ポートは環境により異なります）。

## よく使うコマンド

| コマンド | 説明 |
|----------|------|
| `pnpm dev` | 開発サーバー（ホットリロード） |
| `pnpm build` | 本番ビルド |
| `pnpm preview` | ビルド成果物のローカル確認 |

## トラブルシューティング

### `pnpm: command not found`

Node.js を入れたうえで [pnpm の導入](#pnpm-の導入未インストールの場合) を実行してください。WSL では Windows 側と WSL 側で Node が別インストールになっていることがあります。使うシェル側で `node -v` / `pnpm -v` を確認してください。

### `pnpm install` が遅い・失敗する（WSL + `/mnt/c/`）

リポジトリが Windows ドライブ上にあると I/O が遅くなることがあります。可能なら WSL のホーム（`~/projects/...`）へクローンするか、上記の `wsl bash -lic '...'` 形式で実行してください。

### 画面は出るがキーが効かない

ゲーム開始後、**キャンバスを一度クリック**してフォーカスを当ててください。オーバーレイのボタンにフォーカスがあると `Space` がボタン操作に取られることがあります。

### 起動直後は動くが、しばらくすると画面が止まる

過去に DDA 更新時の不具合でループが止まる事例がありました。最新の `client` を pull したうえで、ブラウザの開発者ツール（F12）→ **Console** にエラーが出ていないか確認してください。

### `npm install` と `pnpm install` を混ぜた

どちらか一方に統一してください。本プロジェクトでは **`pnpm install` + `pnpm-lock.yaml`** を使います。

## 関連ドキュメント

- [難易度調整（DDA）の仕組み](./difficulty-adjustment.md)

## 技術スタック（参考）

- **UI**: React 19, Vite 6
- **ゲーム**: Canvas 2D（`src/game/gameEngine.js`）
- **DDA**: `src/game/aiDirector.js`, `src/game/difficultyParams.js`
