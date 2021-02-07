const Latinum = artifacts.require("Latinum");
const Dilithium = artifacts.require("Dilithium");
const { expect } = require("chai");
const truffleAssert = require("truffle-assertions");

contract("Latinum", (accts) => {
	let ltn, dil, decayHaltFee, decayDur;

	beforeEach(async () => {
		decayHaltFee = web3.utils.toWei("2");
		decayDur = 86400 * 60;
		dil = await Dilithium.new(decayHaltFee, decayDur);
		ltn = await Latinum.new(dil.address, { from: accts[0] });
		await dil.setLTNAddress(ltn.address);
	});

	describe(".mint", async function () {
		it("should mint successfully", async () => {
			const res = await ltn.mint(accts[1], 100);
			const bal = await ltn.balanceOf(accts[1]);
			expect(bal.toNumber()).to.equal(100);
		});

		it("should revert if sender is not the owner", async () => {
			await truffleAssert.reverts(
				ltn.mint(accts[1], 100, { from: accts[1] }),
				"Sender is not owner",
			);
		});

		it("should revert if amount will cause max supply to be exceeded", async () => {
			await ltn.mint(accts[1], "150000000000000000000000000");
			await truffleAssert.reverts(ltn.mint(accts[1], 1), "Cannot exceed max supply");
		});
	});

	describe(".setOwnerOnce", () => {
		it("should revert if sender is not the current/default owner", async () => {
			expect(await ltn.owner()).to.equal(accts[0]);
			await truffleAssert.reverts(
				ltn.setOwnerOnce(accts[1], { from: accts[2] }),
				"Sender is not owner",
			);
		});

		it("should change the owner if the method has not be called before", async () => {
			expect(await ltn.owner()).to.equal(accts[0]);
			const res = await ltn.setOwnerOnce(accts[1]);
			expect(await ltn.owner()).to.equal(accts[1]);
		});

		it("should revert if the method has already been called before", async () => {
			expect(await ltn.owner()).to.equal(accts[0]);
			const res = await ltn.setOwnerOnce(accts[1]);
			expect(await ltn.owner()).to.equal(accts[1]);
			await truffleAssert.reverts(
				ltn.setOwnerOnce(accts[0], { from: accts[1] }),
				"Owner already set",
			);
		});
	});

	describe(".transfer", () => {
		it("should transfer to recipient and update both sender and recipient's decay state", async () => {
			// Mint some LTN and DIL for account#1
			await ltn.mint(accts[1], web3.utils.toWei("10"));
			await dil.mint(accts[1], web3.utils.toWei("10"));
			let dsAcct1 = await dil.getDecayState(accts[1]);
			expect(dsAcct1.rate.gt("0")).to.be.true;

			// Mint some LTN and DIL for account#2
			await ltn.mint(accts[2], web3.utils.toWei("10"));
			await dil.mint(accts[2], web3.utils.toWei("10"));
			let dsAcct2 = await dil.getDecayState(accts[2]);
			expect(dsAcct2.rate.gt("0")).to.be.true;

			// Transfer all LTN from account#1 to account#2
			await ltn.transfer(accts[2], web3.utils.toWei("10"), { from: accts[1] });

			// Ensure account#2 decay state changed.
			let dsAcct2_upd = await dil.getDecayState(accts[2]);
			expect(dsAcct2_upd.rate.toString()).to.not.equal(dsAcct2.toString());
			expect(dsAcct2_upd.rate.toString()).to.equal("0");

			// Ensure account#1 decay rate changed and increased.
			let dsAcct1_upd = await dil.getDecayState(accts[1]);
			expect(dsAcct1_upd.rate.toString()).to.not.equal(dsAcct1.toString());
			expect(dsAcct1_upd.rate.gt(dsAcct1.rate)).to.be.true;
		});
	});

	describe(".transferFrom", () => {
		it("should transfer approved amount to recipient and update both sender and recipient's decay state", async () => {
			// Mint some LTN and DIL for account#1
			await ltn.mint(accts[1], web3.utils.toWei("10"));
			await dil.mint(accts[1], web3.utils.toWei("10"));
			let dsAcct1 = await dil.getDecayState(accts[1]);
			expect(dsAcct1.rate.gt("0")).to.be.true;

			// Mint some LTN and DIL for account#2
			await ltn.mint(accts[2], web3.utils.toWei("10"));
			await dil.mint(accts[2], web3.utils.toWei("10"));
			let dsAcct2 = await dil.getDecayState(accts[2]);
			expect(dsAcct2.rate.gt("0")).to.be.true;

			// Approve all LTN from account#1 to account#2.
			await ltn.approve(accts[2], web3.utils.toWei("10"), { from: accts[1] });

			// Let account#2 transfer all LTN approved by account#1 to account#2
			await ltn.transferFrom(accts[1], accts[2], web3.utils.toWei("10"), {
				from: accts[2],
			});

			// Ensure account#2 decay state changed.
			let dsAcct2_upd = await dil.getDecayState(accts[2]);
			expect(dsAcct2_upd.rate.toString()).to.not.equal(dsAcct2.toString());
			expect(dsAcct2_upd.rate.toString()).to.equal("0");

			// // Ensure account#1 decay rate changed and increased.
			let dsAcct1_upd = await dil.getDecayState(accts[1]);
			expect(dsAcct1_upd.rate.toString()).to.not.equal(dsAcct1.toString());
			expect(dsAcct1_upd.rate.gt(dsAcct1.rate)).to.be.true;
		});
	});

	describe(".burnForMainnet", () => {
		it("should burn balance and emit event", async () => {
			await ltn.mint(accts[1], web3.utils.toWei("10"));
			let mainnetAddr = Buffer.from("some_addr");
			const res = await ltn.burnForMainnet(mainnetAddr, { from: accts[1] });
			let bal = await ltn.balanceOf(accts[1]);
			expect(bal.toString()).to.equal("0");
			expect(res.logs).to.have.lengthOf(2);
			expect(res.logs[0].event).to.equal("Transfer");
			expect(res.logs[1].event).to.equal("BurnForMainnet");
			expect(res.logs[1].args.amount.toString()).to.equal(web3.utils.toWei("10"));
			expect(web3.utils.hexToUtf8(res.logs[1].args.mainnetAddr)).to.equal(
				mainnetAddr.toString("utf8"),
			);
		});
	});
});
