const express = require("express");
const ffmpeg = require("fluent-ffmpeg");
// const ffmpegStatic = require("ffmpeg-static");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = 3000;
const audioFilePath = path.join(__dirname, "1h.wav");
// const audioFilePath = "http://192.168.1.186:41184/bsyb/20241016/1h.wav";

// 切片接口，接受开始时间和结束时间参数
// app.get("/audio-slice", (req, res) => {
//     const { start, end } = req.query;

//     // 验证参数
//     if (!start || !end || isNaN(start) || isNaN(end)) {
//         return res.status(400).send("Invalid start or end time");
//     }

//     const startTime = parseFloat(start); // 开始时间
//     const endTime = parseFloat(end); // 结束时间

//     // 设置输出文件名（可以使用临时文件或者返回流）
//     const outputFilePath = path.join(__dirname, `audio-slice-${start}-${end}.wav`);

//     // 使用 ffmpeg 进行切割
//     ffmpeg(audioFilePath)
//         .setStartTime(startTime) // 设置开始时间
//         .setDuration(endTime - startTime) // 设置切片的持续时间
//         .output(outputFilePath)
//         .on("end", () => {
//             console.log("Audio slice created");

//             // 将切片的音频文件发送给客户端
//             res.sendFile(outputFilePath, (err) => {
//                 if (err) {
//                     console.error("Error sending file:", err);
//                     res.status(500).send("Error sending file");
//                 } else {
//                     // 发送完后删除临时文件
//                     fs.unlinkSync(outputFilePath);
//                 }
//             });
//         })
//         .on("error", (err) => {
//             console.error("Error processing audio file:", err);
//             res.status(500).send("Error processing audio file");
//         })
//         .run();
// });
app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*'); // 允许所有域名访问
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Range');
    next();
});
app.get("/audio-slice", (req, res) => {

    // 打开音频文件，检查是否存在
    fs.stat(audioFilePath, (err, stats) => {
        if (err) {
            console.error("File not found or inaccessible:", err.message);
            return res.status(404).send("Audio file not found");
        }
        // 检查 Range 请求头
        const range = req.headers.range;
        if (!range) {
            return res.status(400).send("Range header is required");
        }

        // 解析 Range 请求头
        const parts = range.replace(/bytes=/, "").split("-");
        console.log('parts', parts);
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : stats.size - 1;

        // 确定要返回的字节范围
        const chunkSize = end - start + 1;
        const file = fs.createReadStream(audioFilePath, { start, end });

        // 设置响应头，返回部分内容
        res.writeHead(206, {
            "Content-Range": `bytes ${start}-${end}/${stats.size}`,
            "Accept-Ranges": "bytes",
            "Content-Length": chunkSize,
            "Content-Type": "audio/wav",
        });
        file.on('data', (chunk) => {
            console.log('Received chunk of data:', chunk);
        });

        file.on('end', () => {
            console.log('File reading finished');
        });

        file.on('error', (err) => {
            console.error('Error reading file:', err.message);
        });
        // 将音频数据流发送给客户端
        file.pipe(res);
    });
});
// 获取音频信息的接口
app.get("/audio-info", (req, res) => {
    // 使用 ffprobe 获取音频文件信息
    ffmpeg.ffprobe(audioFilePath, (err, metadata) => {
        if (err) {
            return res.status(500).json({ error: "Error processing audio file", details: err });
        }

        // 从元数据中提取音频信息
        const audioInfo = {
            format: metadata.format.format_name, // 音频格式
            duration: metadata.format.duration, // 总时长（秒）
            size: metadata.format.size, // 文件大小（字节）
            bit_rate: metadata.format.bit_rate, // 比特率
            sample_rate: metadata.streams[0].sample_rate, // 采样率
            channels: metadata.streams[0].channels, // 声道数
            codec: metadata.streams[0].codec_name, // 编解码器
        };

        // 返回音频信息
        res.send(JSON.stringify(audioInfo));

    });
});


// 启动服务器
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});