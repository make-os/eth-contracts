const Ethers = require("ethers");

module.exports = {
	advanceTime: function (time) {
		return new Promise((resolve, reject) => {
			// prettier-ignore
			web3.currentProvider.send(
			{jsonrpc: "2.0",method: "evm_increaseTime",params: [time],id: new Date().getTime()},
			(err, result) => {
				if (err) {
					return reject(err);
				}
				return resolve(result);
			},
		);
		});
	},

	advanceBlock: function () {
		return new Promise(function (resolve, reject) {
			web3.currentProvider.send(
				{ jsonrpc: "2.0", method: "evm_mine", id: new Date().getTime() },
				(err, result) => {
					if (err) {
						return reject(err);
					}
					const newBlockHash = web3.eth.getBlock("latest").hash;
					return resolve(newBlockHash);
				},
			);
		});
	},

	advanceBlockTime: async function (time) {
		await this.advanceTime(time);
		await this.advanceBlock();
	},

	getCurrentBlockTime: async function () {
		return new Promise(async (resolve, reject) => {
			try {
				let curBlock = await web3.eth.getBlock("latest");
				resolve(curBlock.timestamp);
			} catch (error) {
				reject(error);
			}
		});
	},

	minus: function (val, amt) {
		return new web3.utils.BN(val).sub(new web3.utils.BN(amt.toString()));
	},

	// getLog(provider,weth.address,
	// 	"event Deposit(address indexed dst, uint256 wad);", (log) => { console.log(log) });
	getLog: function (provider, contractAddr, eventAbi, cb) {
		return new Promise(async (res, rej) => {
			let iface = new Ethers.utils.Interface([eventAbi]);
			provider
				.getLogs({
					fromBlock: 0,
					toBlock: "latest",
					address: contractAddr,
				})
				.then((logs) => {
					logs.forEach((log) => {
						let d = iface.parseLog(log);
						// cb(d);
					});
					res();
				})
				.catch(rej);
		});
	},
};

// utils.advanceTime = (time) => {
// 	return new Promise((resolve, reject) => {
// 		// prettier-ignore
// 		web3.currentProvider.send(
// 			{jsonrpc: "2.0",method: "evm_increaseTime",params: [time],id: new Date().getTime()},
// 			(err, result) => {
// 				if (err) {
// 					return reject(err);
// 				}
// 				return resolve(result);
// 			},
// 		);
// 	});
// };

// utils.advanceBlock = () => {
// 	return new Promise((resolve, reject) => {
// 		web3.currentProvider.send(
// 			{ jsonrpc: "2.0", method: "evm_mine", id: new Date().getTime() },
// 			(err, result) => {
// 				if (err) {
// 					return reject(err);
// 				}
// 				const newBlockHash = web3.eth.getBlock("latest").hash;
// 				return resolve(newBlockHash);
// 			},
// 		);
// 	});
// };

// advanceBlockTime = async (time) => {
// 	await utils.advanceTime(time);
// 	await utils.advanceBlock();
// };

// getCurrentBlockTime = async () => {
// 	return new Promise(async (resolve, reject) => {
// 		try {
// 			let curBlock = await web3.eth.getBlock("latest");
// 			resolve(curBlock.timestamp);
// 		} catch (error) {
// 			reject(error);
// 		}
// 	});
// };
