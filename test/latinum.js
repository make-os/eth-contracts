const Latinum = artifacts.require("Latinum");
const Dilithium = artifacts.require("Dilithium");
const { expect } = require("chai");
const truffleAssert = require("truffle-assertions");

contract("Latinum", (accts) => {
	let ltn, dil;

	beforeEach(async () => {
		dil = await Dilithium.new();
		ltn = await Latinum.new(dil.address, { from: accts[0] });
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

	describe(".setOwner", () => {
		it("should revert if sender is not the current/default owner", async () => {
			expect(await ltn.owner()).to.equal(accts[0]);
			await truffleAssert.reverts(
				ltn.setOwner(accts[1], { from: accts[2] }),
				"Sender is not owner",
			);
		});

		it("should change the owner if the method has not be called before", async () => {
			expect(await ltn.owner()).to.equal(accts[0]);
			const res = await ltn.setOwner(accts[1]);
			expect(await ltn.owner()).to.equal(accts[1]);
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
