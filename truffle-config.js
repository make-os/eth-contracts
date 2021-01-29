module.exports = {
	plugins: ["solidity-coverage"],
	compilers: {
		solc: {
			version: "0.6.6",
		},
	},
	networks: {
		development: {
			host: "127.0.0.1",
			port: 7545,
			network_id: "*",
		},
	},
};
