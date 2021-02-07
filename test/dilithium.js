const Dilithium = artifacts.require("Dilithium");
const Auction = artifacts.require("Auction");
const truffleAssert = require("truffle-assertions");
const dayjs = require("dayjs");
const web3 = require("web3");
const { expect } = require("chai");
const BN = web3.utils.BN;
const utils = require("./utils");

contract("Dilithium", function (accts) {
	let curBlockTime;
	let dil, ltn;
	let ltnSupplyPerPeriod, minDILSupply, maxPeriods, minBid;
	let decayHaltFee;
	let decayDur;

	beforeEach(async () => {
		curBlockTime = await utils.getCurrentBlockTime();

		decayHaltFee = web3.utils.toWei("2");
		decayDur = 86400 * 60;
		dil = await Dilithium.new(decayHaltFee, decayDur);

		ltnSupplyPerPeriod = 100;
		maxPeriods = 2;
		minBid = 100;
		minDILSupply = 100;
		ltn = await Auction.new(
			dil.address,
			minDILSupply,
			maxPeriods,
			ltnSupplyPerPeriod,
			minBid,
		);

		await dil.setLTNAddress(ltn.address);
	});

	describe(".mint", async function () {
		it("should mint successfully", async () => {
			const res = await dil.mint(accts[1], 100);
			const bal = await dil.balanceOf(accts[1]);
			expect(bal.toNumber()).to.equal(100);
		});

		it("should revert if sender is not the owner", async () => {
			await truffleAssert.reverts(
				dil.mint(accts[1], 100, { from: accts[1] }),
				"Sender is not owner",
			);
		});
	});

	describe(".burn", async function () {
		it("should burn balance successfully", async () => {
			const res = await dil.mint(accts[1], 100);
			let bal = (await dil.balanceOf(accts[1])).toNumber();
			expect(bal).to.equal(100);

			await dil.burn(100, { from: accts[1] });
			bal = (await dil.balanceOf(accts[1])).toNumber();
			expect(bal).to.equal(0);
		});
	});

	describe(".setOwnerOnce", () => {
		it("should revert if sender is not the current/default owner", async () => {
			expect(await dil.owner()).to.equal(accts[0]);
			await truffleAssert.reverts(
				dil.setOwnerOnce(accts[1], { from: accts[2] }),
				"Sender is not owner",
			);
		});

		it("should change the owner if the method has not be called before", async () => {
			expect(await dil.owner()).to.equal(accts[0]);
			const res = await dil.setOwnerOnce(accts[1]);
			expect(await dil.owner()).to.equal(accts[1]);
		});

		it("should revert if the method has already been called before", async () => {
			expect(await dil.owner()).to.equal(accts[0]);
			const res = await dil.setOwnerOnce(accts[1]);
			expect(await dil.owner()).to.equal(accts[1]);
			await truffleAssert.reverts(
				dil.setOwnerOnce(accts[0], { from: accts[1] }),
				"Owner already set",
			);
		});
	});

	describe(".updateDecayState", () => {
		it("should not set decay state if greater LTN exist to halt DIL decay", async () => {
			await ltn.mint(accts[1], web3.utils.toWei("10")); // 10/2 (halt_fee) = 5
			await dil.mint(accts[1], web3.utils.toWei("4")); // it is < 5 (more than enough)

			await ltn.updateDILDecayState(accts[1]);

			const ds = await dil.getDecayState(accts[1]);
			expect(ds.rate.toNumber()).to.equal(0);
			expect(ds.startTime.toNumber()).to.equal(0);
			expect(ds.endTime.toNumber()).to.equal(0);
		});

		it("should not set decay state if exact LTN exist to halt DIL decay", async () => {
			await ltn.mint(accts[1], web3.utils.toWei("10")); // 10/2 (halt_fee) = 5
			await dil.mint(accts[1], web3.utils.toWei("5")); // it is == 5 (exact)

			await ltn.updateDILDecayState(accts[1]);

			const ds = await dil.getDecayState(accts[1]);
			expect(ds.rate.toNumber()).to.equal(0);
			expect(ds.startTime.toNumber()).to.equal(0);
			expect(ds.endTime.toNumber()).to.equal(0);
		});

		it("should set decay state if not enough LTN exist to halt all DIL decay", async () => {
			await ltn.mint(accts[1], web3.utils.toWei("10")); // 10/2 (halt_fee) = 5
			await dil.mint(accts[1], web3.utils.toWei("10")); // only 5 DIL can be decay-halted

			await ltn.updateDILDecayState(accts[1]);
			curBlockTime = await utils.getCurrentBlockTime();

			const ds = await dil.getDecayState(accts[1]);
			expect(ds.rate.gt(0)).to.be.true;
			expect(ds.startTime.toNumber()).to.equal(curBlockTime);
			expect(ds.endTime.toNumber()).to.equal(curBlockTime + decayDur);
		});

		describe("when an account has an active DIL decay state", () => {
			it("should recalculate decay rate when more LTN is transfer to the account", async () => {
				// Transfer 10 LTN and 10 DIL so that only 5 LTN can be shielded.
				await ltn.mint(accts[1], web3.utils.toWei("10")); // 10/2 (halt_fee) = 5
				await dil.mint(accts[1], web3.utils.toWei("10")); // only 5 DIL will decay, 5 won't.
				let dilBal = await dil.balanceOf(accts[1]);
				expect(dilBal.toString()).to.equal(web3.utils.toWei("10"));

				// Update the account's DIL decay state.
				// NOTE: mint method already did this.
				await ltn.updateDILDecayState(accts[1]);
				let ds = await dil.getDecayState(accts[1]);
				let exRate = new BN(web3.utils.toWei("5")).div(new BN(decayDur.toString()));
				expect(ds.rate.gt(0)).to.be.true;
				curBlockTime = await utils.getCurrentBlockTime();
				expect(ds.startTime.toNumber()).to.equal(curBlockTime);
				expect(ds.endTime.toNumber()).to.equal(curBlockTime + decayDur);

				// We don't expect balance decay since almost no time has passed.
				dilBal = await dil.balanceOf(accts[1]);
				let dilBalDec = parseFloat(web3.utils.fromWei(dilBal, "ether")).toFixed(0);
				expect(dilBalDec).to.equal("10");

				// We expect <= 0 decay since almost no time has passed.
				let decayed = await dil.decayedBalanceOf(accts[1]);
				expect(decayed.toNumber()).to.equal(0);

				// Let 30 days pass (Note: complete decay period is 2 months here).
				await utils.advanceBlockTime(86400 * 30);
				curBlockTime = await utils.getCurrentBlockTime();
				ds = await dil.getDecayState(accts[1]);
				expect(ds.endTime.toNumber() > curBlockTime).to.be.true;

				// We expect 50% (2.5) decay since time has passed.
				decayed = await dil.decayedBalanceOf(accts[1]);
				let decayedDIL = web3.utils.fromWei(decayed.toString(), "ether");
				expect(parseFloat(decayedDIL).toFixed(1)).to.equal("2.5");

				// Expect current balance to be about 7.5
				dilBal = await dil.balanceOf(accts[1]);
				let curDILBal = web3.utils.fromWei(dilBal.toString(), "ether");
				expect(parseFloat(curDILBal).toFixed(1)).to.equal("7.5");

				// Add mint 10 more LTN, enough to halt further decay of the
				// remaining decaying 2.5 DIL
				await ltn.mint(accts[1], web3.utils.toWei("10")); // 10/2 (halt_fee) = 5
				ds = await dil.getDecayState(accts[1]);
				expect(ds.rate.toNumber()).to.equal(0);
				expect(ds.startTime.toNumber()).to.equal(0);
				expect(ds.endTime.toNumber()).to.equal(0);

				// Let 20 days pass.
				await utils.advanceBlockTime(86400 * 20);

				// Balance should still be 7.5 and take no decay.
				dilBal = await dil.balanceOf(accts[1]);
				curDILBal = web3.utils.fromWei(dilBal.toString(), "ether");
				expect(parseFloat(curDILBal).toFixed(1)).to.equal("7.5");
			});
		});
	});

	describe(".transfer", () => {
		it("should transfer expected amounts", async () => {
			// Transfer 10 LTN and 10 DIL so that only 5 LTN can be shielded.
			await ltn.mint(accts[1], web3.utils.toWei("10")); // 10/2 (halt_fee) = 5
			await dil.mint(accts[1], web3.utils.toWei("10")); // only 5 DIL will decay, 5 won't.
			let dilBal = await dil.balanceOf(accts[1]);
			expect(dilBal.toString()).to.equal(web3.utils.toWei("10"));

			// Let 30 days pass (Note: complete decay period is 2 months here).
			await utils.advanceBlockTime(86400 * 30);
			curBlockTime = await utils.getCurrentBlockTime();
			ds = await dil.getDecayState(accts[1]);
			expect(ds.endTime.toNumber() > curBlockTime).to.be.true;

			// We expect 50% (2.5) decay since time has passed.
			decayed = await dil.decayedBalanceOf(accts[1]);
			let decayedDIL = web3.utils.fromWei(decayed.toString(), "ether");
			expect(parseFloat(decayedDIL).toFixed(1)).to.equal("2.5");

			// Try to send some balance (9) which exceeds the spendable
			// balance (7.5). Expect a revert due to insufficient balance.
			await truffleAssert.reverts(
				dil.transfer(accts[2], web3.utils.toWei("9"), { from: accts[1] }),
				"ERC20Decayable: transfer amount exceeds balance",
			);

			// Try to send (7) un-decayed balances.
			// It must succeed with 0.5+ balance left.
			let amtToSend = web3.utils.toWei("7");
			await dil.transfer(accts[2], amtToSend, { from: accts[1] });
			let curDilBal = await dil.balanceOf(accts[1]);
			expect(curDilBal.gte(web3.utils.toWei("0.5"))).to.be.true;
			let toDilBal = await dil.balanceOf(accts[2]);
			expect(toDilBal.toString()).to.equal(amtToSend.toString());

			// Decay rate must be updated for each accounts
			let dsAcct1 = await dil.getDecayState(accts[1]);
			let dsAcct2 = await dil.getDecayState(accts[2]);
			expect(dsAcct1.rate.toString()).to.equal("0");
			expect(dsAcct2.rate.gt(0)).to.be.true;
		});
	});

	describe(".transferFrom", () => {
		it("should transfer expected amounts", async () => {
			// Transfer 10 LTN and 10 DIL so that only 5 LTN can be shielded.
			await ltn.mint(accts[1], web3.utils.toWei("10")); // 10/2 (halt_fee) = 5
			await dil.mint(accts[1], web3.utils.toWei("10")); // only 5 DIL will decay, 5 won't.
			let dilBal = await dil.balanceOf(accts[1]);
			expect(dilBal.toString()).to.equal(web3.utils.toWei("10"));

			// Let 30 days pass (Note: complete decay period is 2 months here).
			await utils.advanceBlockTime(86400 * 30);
			curBlockTime = await utils.getCurrentBlockTime();
			ds = await dil.getDecayState(accts[1]);
			expect(ds.endTime.toNumber() > curBlockTime).to.be.true;

			// We expect 50% (2.5) decay since time has passed.
			decayed = await dil.decayedBalanceOf(accts[1]);
			let decayedDIL = web3.utils.fromWei(decayed.toString(), "ether");
			expect(parseFloat(decayedDIL).toFixed(1)).to.equal("2.5");

			// Approve almost a balance (9) to account[2].
			// This will exceed the spendable balance and includes some decayed amount.
			await dil.approve(accts[2], web3.utils.toWei("9"), { from: accts[1] });
			let allowedBal = await dil.allowance(accts[1], accts[2]);
			expect(allowedBal.toString()).to.equal(web3.utils.toWei("9"));

			// Try to transfer the approved amount (9).
			// Expect a revert due to insufficient balance.
			await truffleAssert.reverts(
				dil.transferFrom(accts[1], accts[2], web3.utils.toWei("9"), { from: accts[2] }),
				"ERC20Decayable: transfer amount exceeds balance",
			);

			// Try to send the 7 un-decayed amount. It should succeed.
			let amtToSend = web3.utils.toWei("7");
			await dil.transferFrom(accts[1], accts[2], amtToSend, { from: accts[2] });
			let curDilBal = await dil.balanceOf(accts[1]);
			expect(curDilBal.gte(web3.utils.toWei("0.5"))).to.be.true;
			let toDilBal = await dil.balanceOf(accts[2]);
			expect(toDilBal.toString()).to.equal(amtToSend.toString());

			// Decay rate must be updated for each accounts
			let dsAcct1 = await dil.getDecayState(accts[1]);
			let dsAcct2 = await dil.getDecayState(accts[2]);
			expect(dsAcct1.rate.toString()).to.equal("0");
			expect(dsAcct2.rate.gt(0)).to.be.true;
		});
	});
});
