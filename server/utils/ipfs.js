const axios = require("axios");
const crypto = require("crypto");

const pinataApiKey = process.env.PINATA_API_KEY;
const pinataSecretApiKey = process.env.PINATA_SECRET_API_KEY;

/**
 * Uploads JSON object or file buffer to Pinata IPFS.
 * Falls back to deterministic mock IPFS hash (Qm...) if Pinata keys are not configured.
 */
async function uploadJSONToIPFS(jsonData) {
  if (pinataApiKey && pinataSecretApiKey) {
    try {
      const res = await axios.post(
        "https://api.pinata.cloud/pinning/pinJSONToIPFS",
        jsonData,
        {
          headers: {
            pinata_api_key: pinataApiKey,
            pinata_secret_api_key: pinataSecretApiKey,
          },
        }
      );
      return {
        success: true,
        ipfsHash: res.data.IpfsHash,
        pinataUrl: `https://gateway.pinata.cloud/ipfs/${res.data.IpfsHash}`,
      };
    } catch (error) {
      console.warn("Pinata API failed, falling back to generated IPFS CID:", error.message);
    }
  }

  // Fallback mock IPFS hash format
  const hash = crypto.createHash("sha256").update(JSON.stringify(jsonData)).digest("hex");
  const mockCid = `QmBITE${hash.substring(0, 40)}`;
  return {
    success: true,
    ipfsHash: mockCid,
    pinataUrl: `https://ipfs.io/ipfs/${mockCid}`,
    isMock: true,
  };
}

module.exports = { uploadJSONToIPFS };
