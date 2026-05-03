// import { Logger,
//   CameraStreamingDelegate,
//   CameraStreamingOptions,
//   StreamingRequest,
//   StreamRequestCallback,
// } from 'homebridge';
// import { ChildProcessWithoutNullStreams, spawn } from 'child_process';


// class StreamingDelegate implements CameraStreamingDelegate {
//   private ffmpegProcess?: ChildProcessWithoutNullStreams;

//   constructor(
//     private readonly log: Logger,
//     private readonly options: CameraStreamingOptions ) {
//     //
//   }

//   handleStreamRequest(request: StreamingRequest, callback: StreamRequestCallback): void {
//     const { sessionID, type } = request;

//     if (type === 'start') {
//       const ffmpegCommand = [
//         '-rtsp_transport', 'tcp',
//         '-i', this.options.source,
//         '-an', // Disable audio for simplicity
//         '-vcodec', 'libx264',
//         '-pix_fmt', 'yuv420p',
//         '-tune', 'zerolatency',
//         '-f', 'rawvideo',
//         '-vf', `scale=${request.video.width}:${request.video.height}`,
//         '-fps_mode', 'cfr',
//         '-r', `${request.video.fps}`,
//         '-preset', 'ultrafast',
//         '-tune', 'zerolatency',
//         '-f', 'mpegts',
//         '-',
//       ];

//       this.ffmpegProcess = spawn('ffmpeg', ffmpegCommand);
//       this.ffmpegProcess.stderr.on('data', (data) => {
//         this.log.debug('FFmpeg stderr:', data.toString());
//       });

//       this.ffmpegProcess.on('error', (err) => {
//         this.log.error('FFmpeg process creation failed:', err.message);
//       });

//       // Pipe the FFmpeg output to the HomeKit video stream
//       this.ffmpegProcess.stdout.pipe(this.getVideoStream(sessionID));
//     } else if (type === 'stop') {
//       if (this.ffmpegProcess) {
//         this.ffmpegProcess.kill('SIGKILL');
//         this.ffmpegProcess = undefined;
//       }
//     }
//   }

// //   handleSnapshotRequest(request: SnapshotRequest, callback: SnapshotRequestCallback): void;
// //   prepareStream(request: PrepareStreamRequest, callback: PrepareStreamCallback): void;
//   ;
// }

// export { StreamingDelegate };