const moment = require("moment");
const web3 = require("web3");
const csv = require("csvtojson");
const BigNumber = require("bignumber.js");

function sqrt(y) {
	let z;
	if (y > 3) {
		z = y;
		x = y / 2 + 1;
		while (x < z) {
			z = x;
			x = (y / x + x) / 2;
		}
	} else if (y != 0) {
		z = 1;
	}
	return z;
}

(async () => {
	function scaleUp(val) {
		return val * 10 ** 18;
	}
	function reward(liquidityAge, liquidity, totalLiquidity) {
		let x = liquidity.times(BigNumber(liquidityAge));
		let reward = Math.sqrt(x.div(BigNumber(totalLiquidity)));
		console.log(
			"LiquidityAge:",
			liquidityAge,
			"Liquidity:",
			liquidity.toString(),
			"Total Reward:",
			totalLiquidity,
			"Reward",
			reward.toString(),
		);
		return reward;
	}

	var liquidityAge = moment.duration(2, "day").asSeconds();
	// var liquidity = web3.utils.toWei("0.00003");
	var liquidity = web3.utils.toWei("122.474487139158903909");
	// var totalLiquidity = web3.utils.toWei("2.89");
	var totalLiquidity = web3.utils.toWei("122.474487139158904909");

	let r = reward(liquidityAge, BigNumber(liquidity), totalLiquidity);
	// const data = await csv().fromFile("./sample.csv");
	// let total = new BigNumber(0);
	// data.forEach((d) => {
	// 	if (d.HolderAddress == "0x0000000000000000000000000000000000000000") {
	// 		return;
	// 	}
	// 	liquidity = new BigNumber(d.Balance).times(10 ** 18);
	// 	let r = reward(liquidityAge, liquidity, totalLiquidity, 10);
	// 	total = total.plus(BigNumber(r));
	// });

	// console.log("Total", total.toString());
})();

// console.log(BigNumber("4.0549843476467E-05").toString());
