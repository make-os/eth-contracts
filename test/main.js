const Main = artifacts.require("Main");
const Latinum = artifacts.require("Latinum");
const Auction = artifacts.require("Auction");
const Dilithium = artifacts.require("Dilithium");
const ELL = artifacts.require("../contracts/libraries/ell/EIP20.sol");
const UniswapV2Library = artifacts.require("./libraries/uniswap/UniswapV2Library.sol");
const IUniswapV2Pair = artifacts.require("./libraries/uniswap/IUniswapV2Pair.sol");
const { expect } = require("chai");
const truffleAssert = require("truffle-assertions");

contract("Main", (accts) => {
	let main, ell, dil, auc;
	let ltnSupplyPerPeriod,
		maxPeriods,
		minBid,
		minDILSupply,
		maxSwappableELL,
		fundingAddr,
		maxInitialLiquidityFund,
		decayHaltFee,
		auctionFee,
		decayDur;

	beforeEach(async () => {
		ltnSupplyPerPeriod = 100;
		maxPeriods = 1;
		minBid = 100;
		minDILSupply = 100;

		ell = await ELL.new("150000000000", "Ellcrys Network Token", 18, "ELL", {
			from: accts[3],
		});

		decayHaltFee = web3.utils.toWei("2");
		decayDur = 86400 * 60;
		dil = await Dilithium.new(decayHaltFee, decayDur, { from: accts[0] });

		fundingAddr = accts[5];
		auctionFee = 0;
		auc = await Auction.new(
			dil.address,
			minDILSupply,
			maxPeriods,
			ltnSupplyPerPeriod,
			minBid,
			fundingAddr,
			auctionFee,
			{ from: accts[0] },
		);

		await dil.setLTNAddress(auc.address);

		maxSwappableELL = 10000;
		let uniswapRouter = "0x0000000000000000000000000000000000000000";
		main = await Main.new(
			maxSwappableELL,
			ell.address,
			dil.address,
			auc.address,
			uniswapRouter,
			{ from: accts[0] },
		);
		await auc.setOwner(main.address, { from: accts[0] });
		await dil.setOwner(main.address, { from: accts[0] });
	});

	describe(".setK", async function () {
		it("should revert if sender is not owner", async () => {
			await truffleAssert.reverts(
				main.setK(accts[6], { from: accts[2] }),
				"Sender is not owner",
			);
		});

		it("should set new address if sender is owner", async () => {
			expect((await main.rewardK()).toString()).to.equal("0");
			await main.setK("123", { from: accts[0] });
			expect((await main.rewardK()).toString()).to.equal("123");
		});
	});

	describe(".mintDIL", () => {
		it("should revert with 'Sender is not owner' if sender is not owner", async () => {
			await truffleAssert.reverts(
				main.mintDIL(accts[1], "100", { from: accts[2] }),
				"Sender is not owner",
			);
		});

		it("should mint DIL successfully", async () => {
			await main.mintDIL(accts[1], "100");
			let bal = await dil.balanceOf(accts[1]);
			expect(bal.toNumber()).to.equal(100);
		});
	});

	describe(".swapELL", async function () {
		it("should revert with 'Swap amount not unlocked' when ELL owner has not unlocked the swap amount in the ELL contract", async () => {
			await truffleAssert.reverts(
				main.swapELL(100, { from: accts[1] }),
				"Swap amount not unlocked",
			);
		});

		it("should revert with 'Swap amount not unlocked' when attempting to swap more than the allowed amount", async () => {
			await ell.approve(main.address, 100, { from: accts[3] });
			await truffleAssert.reverts(main.swapELL(101), "Swap amount not unlocked");
		});

		describe("when swap amount is == approved ELL amount", () => {
			it("should reduce ELL owner's balance and mint LTN of exact swap amount", async () => {
				await ell.approve(main.address, 100, { from: accts[3] });
				const res = await main.swapELL(100, { from: accts[3] });
				expect((await main.swapped()).toNumber()).to.equal(10);

				let ellBal = await ell.balanceOf(accts[3]);
				expect(ellBal.toString()).to.equal("149999999900");
				let ltn = await Auction.at(await main.auc());
				let ltnBal = await ltn.balanceOf(accts[3]);
				expect(ltnBal.toNumber()).to.equal(10);

				expect(res.logs).to.have.lengthOf(1);
				expect(res.logs[0].event).to.equal("SwappedELL");
			});
		});

		describe("when swap amount is < approved ELL amount", () => {
			beforeEach(async () => {
				await ell.approve(main.address, 100, { from: accts[3] });
				await main.swapELL(50, { from: accts[3] });
				expect((await main.swapped()).toNumber()).to.equal(5);
			});

			it("should reduce ELL owner's balance and mint LTN of exact swap amount", async () => {
				let ellBal = await ell.balanceOf(accts[3]);
				expect(ellBal.toString()).to.equal("149999999950");
				let ltn = await Auction.at(await main.auc());
				let ltnBal = await ltn.balanceOf(accts[3]);
				expect(ltnBal.toNumber()).to.equal(5);
			});

			it("should use up the remaining approved ELL", async () => {
				const res = await main.swapELL(50, { from: accts[3] });
				let ellBal = await ell.balanceOf(accts[3]);
				expect(ellBal.toString()).to.equal("149999999900");
				let ltn = await Auction.at(await main.auc());
				let ltnBal = await ltn.balanceOf(accts[3]);
				expect(ltnBal.toNumber()).to.equal(10);

				expect(res.logs).to.have.lengthOf(1);
				expect(res.logs[0].event).to.equal("SwappedELL");

				let remaining = await ell.allowance(accts[3], main.address);
				expect(remaining.toNumber()).to.equal(0);
			});
		});

		describe("test max. swap supply limit", () => {
			beforeEach(async () => {
				await ell.approve(main.address, 9999, { from: accts[3] });
				await main.swapELL(9999, { from: accts[3] });
				expect((await main.swapped()).toNumber()).to.equal(1000);
			});

			it("should revert with 'Total swappable ELL reached' if swap will cause max. swappable supply to be exceeded", async () => {
				await ell.approve(main.address, 2, { from: accts[3] });
				await truffleAssert.reverts(
					main.swapELL(2, { from: accts[3] }),
					"Total swappable ELL reached",
				);
			});

			it("should not revert if swap will not cause max. swappable supply to be exceeded", async () => {
				await ell.approve(main.address, 2, { from: accts[3] });
				await main.swapELL(1, { from: accts[3] });
			});
		});
	});

	describe(".setFundingAddress", () => {
		it("should set funding address", async () => {
			let curFundingAddr = await auc.fundingAddress();
			expect(curFundingAddr).to.equal(accts[5]);
			await main.setFundingAddress(accts[6]);
			curFundingAddr = await auc.fundingAddress();
			expect(curFundingAddr).to.equal(accts[6]);
		});

		it("should revert if sender is not owner", async () => {
			await truffleAssert.reverts(
				main.setFundingAddress(accts[2], { from: accts[4] }),
				"Sender is not owner",
			);
		});
	});
});
