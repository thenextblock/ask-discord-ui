module.exports = {
    apps: [
        {
            name: "ChatAPP",
            script: "npm",
            args: "start",  // This will run `npm start`
            interpreter: "none",  // Ensures PM2 doesn’t try to run this as a JS file
            env: {
                NODE_ENV: "production",
            },
        },
    ],
};
