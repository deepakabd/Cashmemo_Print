import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { LoginError } from './loginService.js';

const clientAndBucket = () => {
  const accountId = String(process.env.CLOUDFLARE_R2_ACCOUNT_ID || '').trim();
  const accessKeyId = String(process.env.CLOUDFLARE_R2_ACCESS_KEY_ID || '').trim();
  const secretAccessKey = String(process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY || '').trim();
  const bucket = String(process.env.CLOUDFLARE_R2_BUCKET || '').trim();
  if (!accountId || !accessKeyId || !secretAccessKey || !bucket) {
    throw new LoginError('r2-not-configured', 'Cloudflare R2 server credentials are not configured.', 503);
  }
  return {
    bucket,
    client: new S3Client({
      region: 'auto',
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId, secretAccessKey },
    }),
  };
};

const objectKey = (userId, monthKey) => `sales-reports/${userId}/${monthKey}.lz-base64`;

export const saveR2SalesMonth = async (userId, monthKey, compressedData) => {
  const { client, bucket } = clientAndBucket();
  await client.send(new PutObjectCommand({
    Bucket: bucket,
    Key: objectKey(userId, monthKey),
    Body: compressedData,
    ContentType: 'text/plain',
    Metadata: { format: 'lz-string-base64', month: monthKey },
  }));
};

export const loadR2SalesMonth = async (userId, monthKey) => {
  const { client, bucket } = clientAndBucket();
  let result;
  try {
    result = await client.send(new GetObjectCommand({ Bucket: bucket, Key: objectKey(userId, monthKey) }));
  } catch (error) {
    if (error?.name === 'NoSuchKey' || error?.Code === 'NoSuchKey' || error?.$metadata?.httpStatusCode === 404) {
      throw new LoginError('r2-object-missing', `Sales Report data for ${monthKey} was not found.`, 404);
    }
    throw error;
  }
  if (!result.Body) throw new LoginError('r2-object-missing', `Sales Report data for ${monthKey} was not found.`, 404);
  return result.Body.transformToString();
};

export const deleteR2SalesMonth = async (userId, monthKey) => {
  const { client, bucket } = clientAndBucket();
  await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: objectKey(userId, monthKey) }));
};
