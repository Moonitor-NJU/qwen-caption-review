# Caption Prompt 迭代总页

固定公开地址：`https://moonitor-nju.github.io/qwen-caption-review/caption-prompt-history/`。

## 维护原则

- 新提示词追加为新版本，放在目录和页面末尾，不覆盖已发布提示词或历史输出。
- 同一提示词扩样可以追加到该版本。已经生成的输出原样保留；修改Prompt正文则新建版本。
- 未生成的版本明确标为draft，不能把人工示例当模型结果。
- 版本ID用于稳定跳转，发布后不要改名。
- 已公开的36条原音复用原地址，不重复上传。

## 本地源文件与生成

本地维护 sources.json、build.py、template.html、styles.css、app.js。运行build.py后，dist目录生成静态站点。
sources.json中的版本按数组顺序展示。数据源指向实际实验目录；build.py核对原音哈希、实际输入和原始输出，再生成公开versions.json。内部服务器路径不会写入公开记录。

## 追加一个版本

1. 为新提示词建立独立实验目录，保存prompt.txt及实际results.json。结果沿用已有记录字段：target、sha256、tagged_text、actual_instruction、output、parsed.caption；白名单版本另有allowed_labels_text。
2. 将该版使用的原音加入经过授权的统一音频清单，提供source_sha256、file或url。已有原音直接复用，新增公开音频需取得授权。
3. 在sources.json的versions数组末尾追加：id、date、title、status、statusLabel、root、changes、outcome；可选notes、extras、sourceUrl、expectedSampleCount。status可为issues、tested或draft。draft只展示提示词和人工示例。
4. 生成并检查dist；发布到同一目录，保留其他页面。样本ID由目标类别和原音哈希组成，同一原音跨版本才会进入同样本对照。
5. 检查Prompt、实际输出、目录跳转、数据加载及音频访问。不得把文件与文字规则检查写成声学准确率或全库成功率。

当前页面从近期跨度标签修订开始整理，不包含本项目全部历史Prompt。文字核对和人工听评应分别记录；已发布独立页面继续保留。
