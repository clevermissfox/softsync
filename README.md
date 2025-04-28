## Prerequisites

Before you begin, ensure you have met the following requirements:

- **Vite React**: Install [Node.js](https://nodejs.org/) (v14.0.0 or higher) and [npm](https://www.npmjs.com/) or use an alternative package manager like [Yarn](https://yarnpkg.com/) or [pnpm](https://pnpm.io/).
- **Git**: Install [Git](https://git-scm.com/) for version control.

## Getting Started

To set up and run the project locally, follow these steps:

### Install Dependencies

Install the project dependencies using your preferred package manager:

```bash
npm install
# or
yarn install
# or
pnpm install
```

### Set Up Environment Variables

```bash
Create a .env file in the root of the project to define your environment-specific variables. Use the .env.example file as a reference.
```

#### Environment Variables

To configure the project, create a `.env` file in the root directory. Refer to the [sample env](./.env.sample)for the required variables. Copy/paste them over to the `.env` file and replace the values with the required keys and secrets from openai and cloudflare.


#### Resource Hints

- **OpenAI API Key**: Obtain from your [OpenAI dashboard](https://platform.openai.com).
- **Cloudflare Credentials**: Get these from the [Cloudflare dashboard](https://dash.cloudflare.com), under R2 storage settings. get the R2_ACCESS_KEY and R2_SECRET_ACCESS_KEY by managing api settings from R3, add a user and you get these tokens. For Public Bucket URL, see /instructions/14.png
- **Security**: Ensure these keys remain secure and are not shared publicly.

  > To avoid **cors** error add these below code into your bucket cors section

```json
[
  {
    "AllowedOrigins": [
      "http://localhost:5173",
      "http://localhost:4173",
      "https://<your-domain>"
    ],
    "AllowedMethods": ["GET", "PUT", "POST", "DELETE", "HEAD"],
    "AllowedHeaders": ["*"],
    "ExposeHeaders": ["ETag", "x-amz-request-id"],
    "MaxAgeSeconds": 3000
  }
]
```

The value in `AllowedOrigins` for `<your-domain>` will be the domain of the live site that needs the cors headers.

### Start the Development Server

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
```

### Editing Pages

```md
You can start editing the page by modifying src/app.jsx. The page auto-updates as you edit the file.
```

### Build for Production

To build the project for production, use your preferred package manager to create an optimized production build:

```bash
npm run build
# or
yarn build
# or
pnpm build
```

### Start the Production Server

Once the build is complete, start the production server:

```bash
npm start
# or
yarn start
# or
pnpm start
```

./components/MyKeyWord.js
Paste your KeyWord


And Your cloudflare Audio file link ------
https://dash.cloudflare.com/813062f12232b3cc97c5d890147d2be9/r2/default/buckets/missfox

### Read more
- its working ??

[See Instruction](./instructions/README.md)

### Still Running into CORS issues?
There is an issue with the way the `@aws-sdk/client-s3` package works with `cloudflare`. You may run into an error where the browser blocks the request for any `4xx` response sent from cloudflare. When the error occurs, cloudflare doesn't send back the required `CORS` headers with the response. The `s3` client then swallows the error with a `failed to fetch` and nothing helpful to debug.

#### Debugging s3 and r2 CORS
The easiest way I have found to debug is to use a `presigned url` with the `s3` client. Follow these steps

1. Install the `aws-sdk/s3-request-presigner` package. This is needed because this app uses `v3` of the sdk s3 client and doesn't ship with a presigner.

```bash
npm install @aws-sdk/s3-request-presigner
```

2. Import the utility function to `presign` the url in the file it's needed

```js
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
```

3. You will then need to pass the `s3` client instance to the `getSignedUrl` function allong with the `command` and an object with an `expiry` time

```js
import { S3Client, ListObjectsV2Command } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

const config = {
  // your configuration
  // this should already be setup for you in the app
}

const client = new S3Client(config)

const command = new ListObectsV2Command({
  Bucket: import.meta.env.VITE_R2_BUCKET_NAME
})

// this url expires in 10 minutes
const url = getSignedUrl(client, command, { expiresIn: 600})
```
5. When you get this url you can do one of two things.

- Log the url to the console, copy it, and run a curl command with it

```js
console.log(url)
```

```curl
curl -v "<presigned-url>"
```

The `-v` adds verbose logging to inspect the tls handshake to confirm an established connection. Curl implicitly `GETS` the response from the url and may need to `PUT` or `DELETE` as necessary


- Make a fetch call and log the error from the url
```js

try {
  const res = await fetch(url)
} catch(e) {
  console.log(e)
}
```

Either way you do it, the response will be in `xml` format.

You may notice a format that looks something like this:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<Error>
  <Code>InvalidArgument</Code>
  <Message>Credential access key has length 37, should be 32</Message>
</Error>
```

The above error would a `400 Bad Request` response from cloudflare. It indicates an `InvalidArgument` error where the access key (`VITE_R2_ACCESS_KEY_ID`) is malformed. The server expects a string length of `32` but got some additional characters (`37`).

Once you are done debugging, you can remove the `aws-sdk/s3-request-presigner` pacakge and remove the test code for debugging the issue.

#### Why debug r2 this way?
Cloudflare has done a wonderful job of making their r2 endpoints compatible with `s3` client requests using the aws sdk package. However, the issue lies in the sdk package itself. When a request fails from cloudflare the s3 client package swallows the error and seemingly doesn't forward the headers or expose them the way they should. This raises a `CORS` error in the browser. Creating a `presigned` url effectively removes the middleman `s3` and makes a request directly to the cloudflare `r2` endpoint. `s3` can no longer swallow the error and hide the headers. So we get a valid error response in `xml` format from cloudflare.
