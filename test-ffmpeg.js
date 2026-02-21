const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('@ffmpeg-installer/ffmpeg');
const fs = require('fs');
const path = require('path');

ffmpeg.setFfmpegPath(ffmpegPath.path);

const crf = 18;

function encode(format) {
    return new Promise((resolve, reject) => {
        const outputPath = path.join(__dirname, `test_output.${format}`);
        ffmpeg()
            // generate 10 seconds of color video
            .input('color=c=blue:s=1920x1080:r=30')
            .inputFormat('lavfi')
            .duration(3)
            .output(outputPath)
            .videoCodec('libx264')
            .outputOptions([
                '-pix_fmt yuv420p',
                `-crf ${crf}`,
                '-preset fast',
                '-movflags +faststart'
            ])
            .on('end', () => resolve(outputPath))
            .on('error', reject)
            .run();
    });
}

async function run() {
    try {
        console.log('Encoding MP4...');
        const mp4Path = await encode('mp4');
        console.log('Encoding MOV...');
        const movPath = await encode('mov');

        const mp4Stat = fs.statSync(mp4Path);
        const movStat = fs.statSync(movPath);

        console.log(`MP4 Size: ${mp4Stat.size} bytes`);
        console.log(`MOV Size: ${movStat.size} bytes`);
    } catch (e) {
        console.error(e);
    }
}

run();
