const Waffle = require("ethereum-waffle");
const Ethers = require("ethers");
const truffleAssert = require("truffle-assertions");
const dayjs = require("dayjs");
const web3 = require("web3");
const UniswapV2FactoryBytecode = require("@uniswap/v2-core/build/UniswapV2Factory.json");
const AuctionBytecode = require("../build/contracts/Auction.json");
const MainBytecode = require("../build/contracts/Main.json");
const DilithiumBytecode = require("../build/contracts/Dilithium.json");
const IUniswapV2Pair = require("@uniswap/v2-core/build/IUniswapV2Pair.json");
const UniswapV2Router02Bytecode = require("../build/contracts/UniswapV2Router02.json");
const WETHBytecode = require("@uniswap/v2-periphery/build/WETH9.json");
const { expect } = require("chai");

describe("LiquidityMining", function () {
	this.timeout(5000);

	let provider = new Waffle.MockProvider({
		ganacheOptions: {
			hardfork: "istanbul",
			mnemonic: "horn horn horn horn horn horn horn horn horn horn horn horn",
			gasLimit: 999999999,
		},
	});
	let accounts;
	let factory, dil, auc, main, weth, router;
	let ltnSupplyPerPeriod,
		maxPeriods,
		minBid,
		minDILSupply,
		maxSwappableELL,
		fundingAddr,
		dilDepositFee,
		maxInitialLiquidityFund;
	let r;
	let lp;

	beforeEach(async function () {
		accounts = provider.getWallets();
		lp = accounts[1];

		factory = await Waffle.deployContract(accounts[0], UniswapV2FactoryBytecode, [
			accounts[0].address,
		]);

		weth = await Waffle.deployContract(accounts[0], WETHBytecode, []);

		router = await Waffle.deployContract(accounts[0], UniswapV2Router02Bytecode, [
			factory.address,
			weth.address,
		]);

		dil = await Waffle.deployContract(accounts[0], DilithiumBytecode, []);

		ltnSupplyPerPeriod = 100;
		maxPeriods = 1;
		minBid = 100;
		minDILSupply = 100;
		auc = await Waffle.deployContract(accounts[0], AuctionBytecode, [
			dil.address,
			minDILSupply,
			maxPeriods,
			ltnSupplyPerPeriod,
			minBid,
		]);

		main = await Waffle.deployContract(accounts[0], MainBytecode, [
			"100000000000000000",
			10000,
			"0x0000000000000000000000000000000000000000",
			dil.address,
			auc.address,
			accounts[5].address,
			router.address,
		]);
	});

	function mintLTN(to, amt) {
		return new Promise(async (res, rej) => {
			try {
				await auc.mint(to, amt);
				const lpBal = (await auc.balanceOf(to)).toString();
				expect(lpBal).to.be.equal(amt);
				res();
			} catch (error) {
				rej(error);
			}
		});
	}

	function mintDIL(to, amt) {
		return new Promise(async (res, rej) => {
			try {
				await dil.mint(to, amt);
				const lpBal = (await dil.balanceOf(to)).toString();
				expect(lpBal).to.be.equal(amt);
				res();
			} catch (error) {
				rej(error);
			}
		});
	}

	function approveLTN(sender, to, amt) {
		return new Promise(async (res, rej) => {
			try {
				await auc.connect(provider.getSigner(sender)).approve(to, amt);
				expect((await auc.allowance(sender, to)).toString()).to.be.equal(amt);
				res();
			} catch (error) {
				rej(error);
			}
		});
	}

	function approveDIL(sender, to, amt) {
		return new Promise(async (res, rej) => {
			try {
				await dil.connect(provider.getSigner(sender)).approve(to, amt);
				expect((await dil.allowance(sender, to)).toString()).to.be.equal(amt);
				res();
			} catch (error) {
				rej(error);
			}
		});
	}

	function getPairContract(tokenA, tokenB, sender) {
		return new Promise(async (res, rej) => {
			try {
				const pairAddress = await factory.getPair(tokenA, tokenB);
				const pair = new Ethers.Contract(
					pairAddress,
					JSON.stringify(IUniswapV2Pair.abi),
					provider,
				).connect(sender);
				res(pair);
			} catch (error) {
				rej(error);
			}
		});
	}

	function addLiquidityEth(
		token,
		desiredTokenAmt,
		minTokenAmt,
		desiredETHAmt,
		amountETHMin,
		liquidityTo,
	) {
		return new Promise(async (res, rej) => {
			try {
				const r = await router
					.connect(provider.getSigner(liquidityTo))
					.addLiquidityETH(
						token,
						desiredTokenAmt,
						minTokenAmt,
						amountETHMin,
						liquidityTo,
						Ethers.constants.MaxUint256,
						{ value: desiredETHAmt },
					);
				res();
			} catch (error) {
				rej(error);
			}
		});
	}

	describe(".lockLiquidity (LTN/WETH)", () => {
		it("should revert with 'Amount not approved' if sender has not approved liquidity amount", async () => {
			let ltnAmt = web3.utils.toWei("50");
			await mintLTN(lp.address, ltnAmt);
			await approveLTN(lp.address, router.address, ltnAmt);

			let ethAmt = web3.utils.toWei("0.1");
			r = await addLiquidityEth(auc.address, ltnAmt, ltnAmt, ethAmt, ethAmt, lp.address);

			await truffleAssert.reverts(
				main.connect(provider.getSigner(lp.address)).lockLiquidity(100000, true),
				"Amount not approved",
			);
		});

		it("should revert with 'Amount not approved' if sender has not approved less than the provided amount", async () => {
			let ltnAmt = web3.utils.toWei("50");
			await mintLTN(lp.address, ltnAmt);
			await approveLTN(lp.address, router.address, ltnAmt);

			let ethAmt = web3.utils.toWei("0.1");
			r = await addLiquidityEth(auc.address, ltnAmt, ltnAmt, ethAmt, ethAmt, lp.address);

			let pair = await getPairContract(auc.address, weth.address, accounts[0]);
			let lpLiquidity = await pair.balanceOf(lp.address);
			await pair
				.connect(provider.getSigner(lp.address))
				.approve(main.address, lpLiquidity.sub("1"));

			await truffleAssert.reverts(
				main.connect(provider.getSigner(lp.address)).lockLiquidity(lpLiquidity, true),
				"Amount not approved",
			);
		});

		describe("when sender has approved the liquidity amount", () => {
			it("should transfer approved liquidity and create a liquidity ticket", async () => {
				let ltnAmt = web3.utils.toWei("50");
				await mintLTN(lp.address, ltnAmt);
				await approveLTN(lp.address, router.address, ltnAmt);

				let ethAmt = web3.utils.toWei("0.1");
				r = await addLiquidityEth(
					auc.address,
					ltnAmt,
					ltnAmt,
					ethAmt,
					ethAmt,
					lp.address,
				);

				let pair = await getPairContract(auc.address, weth.address, accounts[0]);
				let lpLiquidity = await pair.balanceOf(lp.address);
				await pair
					.connect(provider.getSigner(lp.address))
					.approve(main.address, lpLiquidity);

				await main
					.connect(provider.getSigner(lp.address))
					.lockLiquidity(lpLiquidity, true);

				let curLiquidity = await pair.balanceOf(lp.address);
				expect(curLiquidity.toString()).to.equal("0");

				let contractLiquidity = await pair.balanceOf(main.address);
				expect(contractLiquidity.eq(lpLiquidity)).to.be.true;

				let lt = await main.liquidityTickets(lp.address);
				expect(lt.amount.eq(lpLiquidity)).to.be.true;
				expect(lt.lockedAt.toNumber() > 0).to.be.true;
				expect(lt.LTN_ETH).to.equal(true);
				expect(lt.DIL_ETH).to.equal(false);
			});
		});
	});

	describe(".lockLiquidity (DIL/WETH)", () => {
		it("should revert with 'Amount not approved' if sender has not approved liquidity amount", async () => {
			let dilAmt = web3.utils.toWei("50");
			await mintDIL(lp.address, dilAmt);
			await approveDIL(lp.address, router.address, dilAmt);

			let ethAmt = web3.utils.toWei("0.1");
			r = await addLiquidityEth(dil.address, dilAmt, dilAmt, ethAmt, ethAmt, lp.address);

			await truffleAssert.reverts(
				main.connect(provider.getSigner(lp.address)).lockLiquidity(100000, false),
				"Amount not approved",
			);
		});

		describe("when sender has approved the liquidity amount", () => {
			it("should transfer approved liquidity and create a liquidity ticket", async () => {
				let dilAmt = web3.utils.toWei("50");
				await mintDIL(lp.address, dilAmt);
				await approveDIL(lp.address, router.address, dilAmt);

				let ethAmt = web3.utils.toWei("0.1");
				r = await addLiquidityEth(
					dil.address,
					dilAmt,
					dilAmt,
					ethAmt,
					ethAmt,
					lp.address,
				);

				let pair = await getPairContract(dil.address, weth.address, accounts[0]);
				let lpLiquidity = await pair.balanceOf(lp.address);
				await pair
					.connect(provider.getSigner(lp.address))
					.approve(main.address, lpLiquidity);

				await main
					.connect(provider.getSigner(lp.address))
					.lockLiquidity(lpLiquidity, false);

				let curLiquidity = await pair.balanceOf(lp.address);
				expect(curLiquidity.toString()).to.equal("0");

				let contractLiquidity = await pair.balanceOf(main.address);
				expect(contractLiquidity.eq(lpLiquidity)).to.be.true;

				let lt = await main.liquidityTickets(lp.address);
				expect(lt.amount.eq(lpLiquidity)).to.be.true;
				expect(lt.lockedAt.toNumber() > 0).to.be.true;
				expect(lt.LTN_ETH).to.equal(false);
				expect(lt.DIL_ETH).to.equal(true);
			});
		});
	});
});

// getLog(provider,weth.address,
// 	"event Deposit(address indexed dst, uint256 wad);", (log) => { console.log(log) });
async function getLog(provider, contractAddr, eventAbi, cb) {
	let iface = new utils.Interface([eventAbi]);
	await provider
		.getLogs({
			fromBlock: 0,
			toBlock: "latest",
			address: contractAddr,
		})
		.then((logs) => {
			logs.forEach((log) => {
				let d = iface.parseLog(log);
				cb(d);
			});
		});
}
