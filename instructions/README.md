## Step-1

![image info](./1.png)

## Step-2

![image info](./2.jpeg)

## Step-3

![image info](./3.png)

## Step-4

![image info](./4.png)

## Step-5

![image info](./5.png)

## Step-6

![image info](./6.png)

## Step-7

![image info](./7.png)

## Step-8
(also see [retrieving ids and keys](#retrieving-r2_access_key_id-and-r2_secret_access_key) for current ui at the time of this writing)

![image info](./8.png)

## Step-9

![image info](./9.png)

## Step-10

![image info](./10.png)

## Step-11

![image info](./11.png)

## Step-12

![image info](./12.png)

## Your Audio Stored Here

![image info](./13.jpeg)

## Getting Public Bucket URL

Click on your bucket name (e.g. `missfox`) and navigate to 'Settings', scroll down to `R2.dev subdomain` section where you will enable access and retrieve the value of `Public R2.dev Bucket URL` (or if you've connected a custom domain to your bucket, that will also work as the public bucket url); This is what the value of the environment variable `VITE_PUBLIC_R2_BUCKET_URL` will be 
![image info](./14-Public%20Bucket%20URL.png)

## Retrieving `R2_ACCESS_KEY_ID` and `R2_SECRET_ACCESS_KEY`
(See [steps 8](#step-8) - 11)
On the R2 Object Storage Page where all of your buckets are listed, trigger `{} API` dropdown then select `Manage API Tokens` and create a `User API Token`; you will be given an access key ID and secret access key which will be the values for the respective env variables
![image_info](./15-get_accessID_accessKey.png)

##Deployed on Cloudflare Pages
