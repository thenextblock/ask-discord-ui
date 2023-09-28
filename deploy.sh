REMOTE_PATH=/root/langchain/chat-ui

echo "------------------------------------"
echo "Starting uploading to the server ..."

# Step 1: Copy files to the remote serer directory
echo "[1/1] Coping files to the remote serer directory ..."
rsync -avv  --exclude .next  --exclude .git --exclude /node_modules  ./ erigon:$REMOTE_PATH/  || { echo "Failed! Exiting..."; exit 1; }