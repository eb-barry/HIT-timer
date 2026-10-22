# 高強度間歇訓練計時器

手機優先的間歇訓練計時器。準備、鍛鍊、休息、循環間休息與冷卻都會用語音和嗶聲提示，最後三秒會說「三、二、一」，接著說出下一個動作。

```bash
npm install
npm run dev
npm test
```

## GitHub Pages

`https://eb-barry.github.io/HIT-timer/` 必須發布建置後的 `dist`，不能直接打開倉庫裡的 `index.html`。推上 `main` 後，GitHub Actions 會以 `/HIT-timer/` 為基底路徑建置並部署。倉庫的 Pages 設定要選 **GitHub Actions**，不要選 Deploy from a branch。

## 真人語音

電腦語音是暫時的做法。把 MP3 放到 `public/voices/`，檔名固定如下：

| 句子 | 檔名 |
| --- | --- |
| 準備 | `prepare.mp3` |
| 鍛鍊 | `work.mp3` |
| 休息 | `rest.mp3` |
| 循環休息 | `cycle-rest.mp3` |
| 冷卻 | `cooldown.mp3` |
| 完成 | `complete.mp3` |
| 三 | `three.mp3` |
| 二 | `two.mp3` |
| 一 | `one.mp3` |

可以只放其中幾句。三、二、一請各錄成短於一秒的獨立檔案。放好之後，在右上角齒輪的「設定」裡按「重新偵測語音檔」，或把對應的 id 寫進 `public/voices/index.json` 的 `clips`。缺檔的句子會繼續用電腦語音。
