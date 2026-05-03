// import { FBXRequestResult } from "../network/Network";
// import { RequestQueueItem, RetryPolicy } from "./FreeboxRequest";
// import { FBXLoginSessionReply } from "./FreeboxSession";

// interface Strategy {
//     perform(
//         method: RequestQueueItem['method'],
//         url: string,
//         body: unknown,
//         retryPolicy: RetryPolicy,
//         retry_count: number,
//         response: FBXRequestResult,
//         respBody: FBXLoginSessionReply,
//       ): Promise<FBXRequestResult>;
// }


// class ReplyFailed implements Strategy {
//     perform(
//         method: RequestQueueItem['method'],
//         url: string,
//         body: unknown,
//         retryPolicy: RetryPolicy,
//         retry_count: number,
//         response: FBXRequestResult,
//         respBody: FBXLoginSessionReply,
//       ): Promise<FBXRequestResult> {
//         // server replied but no cigar ..
//         if (retryPolicy === RetryPolicy.AUTO_RETRY) {
//           // retry !
//           if (retry_count < 3) {
//             retry_count += 1;
//             await this.delay(this.RETRY_TIMEOUT);
//             return this.request(method, url, body, retryPolicy, retry_count);
//             // <============= QUIT
//           } else {
//             throw new Error(`Request failed after ${retry_count} retries. ${JSON.stringify(response)}`);
//           }
//         } else {
//           // go to next request in line
//           this.processNextRequest();
//           // return data as is
//           return { status_code: response.status_code, data: respBody };
//           // <============= QUIT
//         }
//       }

// }