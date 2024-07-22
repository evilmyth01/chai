import express from "express"
import cors from "cors"
import multer from "multer"
import { v4 as uuidv4 } from "uuid"
import path from "path"
import fs from "fs"
import {exec} from "child_process" // watch out
import axios from "axios"
import { stderr, stdout } from "process"

const app = express()

//multer middleware

const storage = multer.diskStorage({
  destination: function(req, file, cb){
    cb(null, "./uploads")
  },
  filename: function(req, file, cb){
    cb(null, file.fieldname + "-" + uuidv4() + path.extname(file.originalname))
  }
})

// multer configuration
const upload = multer({storage: storage})


app.use(
  cors({
    origin: ["http://localhost:3000", "http://localhost:5174"],
    credentials: true
  })
)

app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*") // watch it
  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept"
  );
  next()
})

app.use(express.json())
app.use(express.urlencoded({extended: true}))
app.use("/uploads", express.static("uploads"))

app.get('/', function(req, res){
  res.json({message: "Hello chai aur code"})
})

// app.post("/upload", upload.single('file'), function(req, res){
//   const lessonId = uuidv4()
//   const videoPath = req.file.path
//   const outputPath = `./uploads/courses/${lessonId}`
//   const hlsPath = `${outputPath}/index.m3u8`
//   console.log("hlsPath", hlsPath)

//   if (!fs.existsSync(outputPath)) {
//     fs.mkdirSync(outputPath, {recursive: true})
//   }

//   // ffmpeg
//   const ffmpegCommand = `ffmpeg -i ${videoPath} -codec:v libx264 -codec:a aac -hls_time 10 -hls_playlist_type vod -hls_segment_filename "${outputPath}/segment%03d.ts" -start_number 0 ${hlsPath}

// `;

//   // no queue because of POC, not to be used in production
//   exec(ffmpegCommand, (error, stdout, stderr) => {
//     if (error) {
//       console.log(`exec error: ${error}`)
//     }
//     console.log(`stdout: ${stdout}`)
//     console.log(`stderr: ${stderr}`)
//     const videoUrl = `http://localhost:8000/uploads/courses/${lessonId}/index.m3u8`;

//     res.json({
//       message: "Video converted to HLS format",
//       videoUrl: videoUrl,
//       lessonId: lessonId
//     })
//   })

// })

app.post("/upload", upload.single('file'), async function(req, res){
    const lessonId = uuidv4();
    const outputPath = `./uploads/courses/${lessonId}`;
    const hlsPath = `${outputPath}/index.m3u8`;
    const masterPlaylistPath = `${outputPath}/master.m3u8`;


    console.log("hlsPath", hlsPath);
    console.log("masterPlaylistPath", masterPlaylistPath);
  
    if (!fs.existsSync(outputPath)) {
      fs.mkdirSync(outputPath, { recursive: true });
    }
  
    // Download video from Cloudinary
    const videoUrl = "http://res.cloudinary.com/dtbqnu4hr/video/upload/v1717172499/ged6f0yxsmsdqec2tl9o.mp4";
    const tempVideoPath = `./uploads/temp/${lessonId}.mp4`;
  
    try {
      const response = await axios({
        method: 'get',
        url: videoUrl,
        responseType: 'stream'
      });
  
      const writer = fs.createWriteStream(tempVideoPath);
  
      response.data.pipe(writer);
  
      writer.on('finish', () => {
        // ffmpeg command to convert the downloaded video to HLS format
        const ffmpegCommand = `ffmpeg -hide_banner -re -i ${tempVideoPath} \
  -map 0:v:0 -map 0:a:0 -map 0:v:0 -map 0:a:0 -map 0:v:0 -map 0:a:0 -map 0:v:0 -map 0:a:0 \
  -c:v h264 -profile:v main -crf 20 -sc_threshold 0 -g 48 -keyint_min 48 -c:a aac -ar 48000 \
  -filter:v:0 scale=w=640:h=360:force_original_aspect_ratio=decrease -maxrate:v:0 856k -bufsize:v:0 1200k -b:a:0 96k \
  -filter:v:1 scale=w=842:h=480:force_original_aspect_ratio=decrease -maxrate:v:1 1498k -bufsize:v:1 2100k -b:a:1 128k \
  -filter:v:2 scale=w=1280:h=720:force_original_aspect_ratio=decrease -maxrate:v:2 2996k -bufsize:v:2 4200k -b:a:2 128k \
  -filter:v:3 scale=w=1920:h=1080:force_original_aspect_ratio=decrease -maxrate:v:3 5350k -bufsize:v:3 7500k -b:a:3 192k \
  -var_stream_map "v:0,a:0 v:1,a:1 v:2,a:2 v:3,a:3" \
  -hls_time 10 \
  -master_pl_name master.m3u8 \
  -hls_segment_filename "${outputPath}/%v_%03d.ts" "${outputPath}/%v.m3u8"`;


        // const ffmpegCommand = `ffmpeg -i ${inputPath} -vf scale=${resolution.width}:${resolution.height} -c:v libx264 -c:a aac -f hls -hls_time 10 -hls_list_size 0 -hls_segment_filename "${segmentFilePath}" ${playlistFilePath}`;
  
        // Execute the ffmpeg command
        exec(ffmpegCommand, (error, stdout, stderr) => {
          if (error) {
            console.log(`exec error: ${error}`);
            return res.status(500).json({ error: "Error converting video to HLS format" });
          }
  
          console.log(`stdout: ${stdout}`);
          console.log(`stderr: ${stderr}`);
  
          const videoUrl = `http://localhost:8000/uploads/courses/${lessonId}/index.m3u8`;
  
          // Respond with the HLS video URL and lesson ID
          res.json({
            message: "Video converted to HLS format",
            videoUrl: videoUrl,
            lessonId: lessonId
          });
  
          // Clean up the temporary video file
          fs.unlinkSync(tempVideoPath);
        });
      });
  
      writer.on('error', (error) => {
        console.log(`Download error: ${error}`);
        return res.status(500).json({ error: "Error downloading video from Cloudinary" });
      });
  
    } catch (error) {
      console.log(`Axios error: ${error}`);
      return res.status(500).json({ error: "Error downloading video from Cloudinary" });
    }
  });

app.listen(8001, function(){
  console.log("App is listening at port 8001...")
})




// "http://localhost:8000/uploads/courses/5f1af126-f9d3-49db-a02e-d44e138c8e5b/index.m3u8"   144p video
// "http://localhost:8000/uploads/courses/0f6b879a-fa38-4636-9fd4-29ee6e863ac2/index.m3u8"  720p video