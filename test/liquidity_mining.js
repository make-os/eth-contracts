const Waffle = require("ethereum-waffle");
const Ethers = require("ethers");
const truffleAssert = require("truffle-assertions");
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
	this.timeout(20000);

	let provider = new Waffle.MockProvider({
		ganacheOptions: {
			hardfork: "istanbul",
			mnemonic: "horn horn horn horn horn horn horn horn horn horn horn horn",
			gasLimit: 999999999,
		},
	});
	let accts;
	let factory, dil, auc, main, weth, router;
	let ltnSupplyPerPeriod,
		maxPeriods,
		minBid,
		minDILSupply,
		maxSwappableELL,
		fundingAddr,
		maxInitialLiquidityFund,
		decayHaltFee,
		decayDur;
	let r;
	let lp;
	let lps;

	beforeEach(async function () {
		accts = provider.getWallets();
		lp = accts[1];
		lps = provider.getSigner(lp.address);

		factory = await Waffle.deployContract(accts[0], UniswapV2FactoryBytecode, [
			accts[0].address,
		]);

		weth = await Waffle.deployContract(accts[0], WETHBytecode, []);

		router = await Waffle.deployContract(accts[0], UniswapV2Router02Bytecode, [
			factory.address,
			weth.address,
		]);

		decayHaltFee = web3.utils.toWei("2");
		decayDur = 86400 * 60;
		dil = await Waffle.deployContract(accts[0], DilithiumBytecode, [
			decayHaltFee,
			decayDur,
		]);

		ltnSupplyPerPeriod = 100;
		maxPeriods = 1;
		minBid = 100;
		minDILSupply = 100;
		fundingAddr = accts[5].address;
		auc = await Waffle.deployContract(accts[0], AuctionBytecode, [
			dil.address,
			minDILSupply,
			maxPeriods,
			ltnSupplyPerPeriod,
			minBid,
			fundingAddr,
		]);

		await dil.setLTNAddress(auc.address);

		main = await Waffle.deployContract(accts[0], MainBytecode, [
			10000,
			"0x0000000000000000000000000000000000000000",
			dil.address,
			auc.address,
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
				// prettier-ignore
				const r = await router
					.connect(provider.getSigner(liquidityTo))
					.addLiquidityETH(token,desiredTokenAmt,minTokenAmt,amountETHMin,liquidityTo,Ethers.constants.MaxUint256,{ value: desiredETHAmt });
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
				main.connect(lps).lockLiquidity(100000),
				"Amount not approved",
			);
		});

		it("should revert with 'Amount not approved' if sender has not approved less than the provided amount", async () => {
			let ltnAmt = web3.utils.toWei("50");
			await mintLTN(lp.address, ltnAmt);
			await approveLTN(lp.address, router.address, ltnAmt);

			let ethAmt = web3.utils.toWei("0.1");
			r = await addLiquidityEth(auc.address, ltnAmt, ltnAmt, ethAmt, ethAmt, lp.address);

			let pair = await getPairContract(auc.address, weth.address, accts[0]);
			let lpLiquidity = await pair.balanceOf(lp.address);
			await pair.connect(lps).approve(main.address, lpLiquidity.sub("1"));

			await truffleAssert.reverts(
				main.connect(lps).lockLiquidity(lpLiquidity),
				"Amount not approved",
			);
		});

		describe("when sender has approved the liquidity amount", () => {
			it("should transfer approved liquidity and create a liquidity ticket", async () => {
				let ltnAmt = web3.utils.toWei("50");
				await mintLTN(lp.address, ltnAmt);
				await approveLTN(lp.address, router.address, ltnAmt);

				let ethAmt = web3.utils.toWei("0.1");
				// prettier-ignore
				r = await addLiquidityEth(auc.address,ltnAmt,ltnAmt,ethAmt,ethAmt,lp.address);

				let pair = await getPairContract(auc.address, weth.address, accts[0]);
				let lpLiquidity = await pair.balanceOf(lp.address);
				await pair.connect(lps).approve(main.address, lpLiquidity);

				await main.connect(lps).lockLiquidity(lpLiquidity);

				let curLiquidity = await pair.balanceOf(lp.address);
				expect(curLiquidity.toString()).to.equal("0");

				let contractLiquidity = await pair.balanceOf(main.address);
				expect(contractLiquidity.eq(lpLiquidity)).to.be.true;

				let lt = await main.lockedLTN_WETH(lp.address);
				expect(lt.amount.eq(lpLiquidity)).to.be.true;
				expect(lt.lockedAt.toNumber() > 0).to.be.true;
				expect(lt.LTN_ETH).to.equal(true);
				expect(lt.DIL_ETH).to.equal(false);
			});
		});

		describe("when sender has previously locked liquidity with same address", () => {
			it("should transfer approved liquidity and create a liquidity ticket", async () => {
				let ltnAmt = web3.utils.toWei("50");
				await mintLTN(lp.address, ltnAmt);
				await approveLTN(lp.address, router.address, ltnAmt);
				let ethAmt = web3.utils.toWei("0.1");
				// prettier-ignore
				r = await addLiquidityEth(auc.address,ltnAmt,ltnAmt,ethAmt,ethAmt,lp.address);
				let pair = await getPairContract(auc.address, weth.address, accts[0]);
				let lpLiquidity = await pair.balanceOf(lp.address);
				await pair.connect(lps).approve(main.address, lpLiquidity);
				await main.connect(lps).lockLiquidity(lpLiquidity);
				let lt = await main.lockedLTN_WETH(lp.address);
				expect(lt.amount.eq(lpLiquidity)).to.be.true;

				/** LP adds and locks liquidity again from same address */

				ltnAmt = web3.utils.toWei("50");
				await mintLTN(lp.address, ltnAmt);
				await approveLTN(lp.address, router.address, ltnAmt);
				ethAmt = web3.utils.toWei("0.1");
				// prettier-ignore
				r = await addLiquidityEth(auc.address,ltnAmt,ltnAmt,ethAmt,ethAmt,lp.address);
				pair = await getPairContract(auc.address, weth.address, accts[0]);
				let lpLiquidity2 = await pair.balanceOf(lp.address);
				await pair.connect(lps).approve(main.address, lpLiquidity2);
				await main.connect(lps).lockLiquidity(lpLiquidity2);

				// LP ticket should be the sum of all previously locked liquidity
				let lt2 = await main.lockedLTN_WETH(lp.address);
				let expected = lpLiquidity.add(lpLiquidity2);
				expect(lt2.amount.eq(expected)).to.be.true;
			});
		});
	});

	describe(".unlockLiquidity (LTN/WETH)", () => {
		it("should revert when sender has no liquidity ticket", async () => {
			await truffleAssert.reverts(main.unlockLiquidity(), "Liquidity not found");
		});

		it("should return locked liquidity and remove liquidity ticket", async () => {
			let ltnAmt = web3.utils.toWei("50");
			await mintLTN(lp.address, ltnAmt);
			await approveLTN(lp.address, router.address, ltnAmt);
			let ethAmt = web3.utils.toWei("0.1");

			r = await addLiquidityEth(auc.address, ltnAmt, ltnAmt, ethAmt, ethAmt, lp.address);
			let pair = await getPairContract(auc.address, weth.address, accts[0]);
			let lpLiquidity = await pair.balanceOf(lp.address);
			await pair.connect(lps).approve(main.address, lpLiquidity);
			await main.connect(lps).lockLiquidity(lpLiquidity);

			// Check that the contract has the liquidity
			let contractLiquidity = await pair.balanceOf(main.address);
			expect(contractLiquidity.toString()).to.equal(lpLiquidity.toString());

			// Check that the LP no longer has the liquidity
			let curLPLiquidity = await pair.balanceOf(lp.address);
			expect(curLPLiquidity.toString()).to.equal("0");

			let lt = await main.lockedLTN_WETH(lp.address);
			expect(lt.amount.eq(lpLiquidity)).to.be.true;

			// Unlock the liquidity
			await main.connect(lps).unlockLiquidity();

			// Should revert because the liquidity ticket no longer exists
			lt = await main.lockedLTN_WETH(lp.address);
			expect(lt.amount.toString()).to.equal("0");
			expect(lt.lockedAt.toString()).to.equal("0");

			// Check that the liquidity is back in the LP's account.
			curLPLiquidity = await pair.balanceOf(lp.address);
			expect(curLPLiquidity.toString()).to.equal(lpLiquidity.toString());

			// Check that the contract no longer has the liquidity
			contractLiquidity = await pair.balanceOf(main.address);
			expect(contractLiquidity.toString()).to.equal("0");
		});
	});

	describe(".calcSenderLiquidityReward", () => {
		it("should revert when sender has no liquidity ticket", async () => {
			await truffleAssert.reverts(
				main.calcSenderLiquidityReward(0),
				"Liquidity not found",
			);
		});

		it("should return expected reward when sender has a liquidity ticket", async () => {
			let ltnAmt = web3.utils.toWei("500");
			await mintLTN(lp.address, ltnAmt);
			await approveLTN(lp.address, router.address, ltnAmt);
			let ethAmt = web3.utils.toWei("30");

			// Add liquidity
			// prettier-ignore
			r = await addLiquidityEth(auc.address,ltnAmt,ltnAmt,ethAmt,ethAmt,lp.address);
			let pair = await getPairContract(auc.address, weth.address, accts[0]);
			let lpLiquidity = await pair.balanceOf(lp.address);

			// Approve and lock liquidity
			const signer = lps;
			await pair.connect(signer).approve(main.address, lpLiquidity);
			await main.connect(signer).lockLiquidity(lpLiquidity);

			// LP liquidity should be 0
			curLiquidity = await pair.balanceOf(lp.address);
			expect(curLiquidity.toString()).to.equal("0");

			// Let the liquidity age
			const future = parseInt((Date.now() + 2000) / 1000);
			let reward = await main.connect(signer).calcSenderLiquidityReward(future);
			expect(reward.toNumber()).to.equal(1);
		});
	});

	describe(".claimLiquidityReward (LTN/WETH)", () => {
		it("should revert when sender has no liquidity ticket", async () => {
			await truffleAssert.reverts(main.claimLiquidityReward(), "Liquidity not found");
		});

		describe("when sender has liquidity", () => {
			let lpLiquidity, lt;

			beforeEach(async () => {
				let ltnAmt = web3.utils.toWei("500");
				await mintLTN(lp.address, ltnAmt);
				await approveLTN(lp.address, router.address, ltnAmt);
				let ethAmt = web3.utils.toWei("30");

				// Add liquidity
				r = await addLiquidityEth(
					auc.address,
					ltnAmt,
					ltnAmt,
					ethAmt,
					ethAmt,
					lp.address,
				);
				let pair = await getPairContract(auc.address, weth.address, accts[0]);
				lpLiquidity = await pair.balanceOf(lp.address);

				// Approve and lock liquidity
				await pair.connect(lps).approve(main.address, lpLiquidity);
				await main.connect(lps).lockLiquidity(lpLiquidity);

				// LP liquidity should be 0
				curLiquidity = await pair.balanceOf(lp.address);
				expect(curLiquidity.toString()).to.equal("0");

				// LP liquidity should be locked, lock time should be recorded
				lt = await main.lockedLTN_WETH(lp.address);
				expect(lt.amount.eq(lpLiquidity)).to.be.true;
				const now = parseInt(Date.now() / 1000);
				expect(lt.lockedAt.toNumber()).to.be.within(now - 1, now + 1);

				// Let the liquidity age
				await new Promise((resolve) => setTimeout(resolve, 2000));
				const now2 = parseInt(Date.now() / 1000);
				lt = await main.lockedLTN_WETH(lp.address);
				expect(lt.lockedAt.toNumber() < now2).to.be.true;

				// Make Main the owner of the auction contract.
				await auc.setOwner(main.address);
			});

			it("should claim reward when sender has a liquidity ticket", async () => {
				await main.connect(lps).claimLiquidityReward();

				// LP should receive LTN reward
				let ltnBal = await auc.balanceOf(lp.address);
				expect(ltnBal.toNumber()).to.equal(1);

				// Locked liquidity should be untouched but the lock time
				// should be reset to a recent time greater than the previous.
				let lt2 = await main.lockedLTN_WETH(lp.address);
				expect(lt2.amount.eq(lpLiquidity)).to.be.true;
				expect(lt2.lockedAt.toNumber() > lt.lockedAt.toNumber()).to.be.true;
			});

			describe("when K constant is set", () => {
				it("should claim reward + K", async () => {
					await main.setK(10);
					await main.connect(lps).claimLiquidityReward();
					let ltnBal = await auc.balanceOf(lp.address);
					expect(ltnBal.toNumber()).to.equal(11);
				});
			});
		});
	});

	describe(".calcLiquidityReward", () => {
		it("should return expected results", async () => {
			// prettier-ignore
			let expected = new web3.utils.BN("122474487139158903909").mul(new web3.utils.BN("1")).
				div(new web3.utils.BN("122474487139158903909")).sqr();

			// prettier-ignore
			let r = await main.calcLiquidityReward(1,"122474487139158903909","122474487139158903909");
			expect(r.toNumber()).to.equal(expected.toNumber());

			// prettier-ignore
			expected = parseInt(
				Math.sqrt(new web3.utils.BN("122474487139158903909").mul(new web3.utils.BN(86400)).
					div(new web3.utils.BN("122474487139158903909")).toNumber(),
				),
			);

			// prettier-ignore
			r = await main.calcLiquidityReward(86400, "122474487139158903909", "122474487139158903909");
			expect(r.toNumber()).to.equal(expected);

			// prettier-ignore
			expected = parseInt(
				Math.sqrt(new web3.utils.BN("122474487139158903909").mul(new web3.utils.BN(86400 * 365)).
					div(new web3.utils.BN("122474487139158903909")).toNumber(),
				),
			);

			// prettier-ignore
			r = await main.calcLiquidityReward(86400*365, "122474487139158903909", "122474487139158903909");
			expect(r.toNumber()).to.equal(expected);
		});
	});
});
