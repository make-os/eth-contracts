const Latinum = artifacts.require("Latinum");
const Dilithium = artifacts.require("Dilithium");
const truffleAssert = require("truffle-assertions");

contract("Latinum", (accounts) => {
	let ltn, dil, decayHaltFee, decayDur;

	beforeEach(async () => {
		decayHaltFee = web3.utils.toWei("2");
		decayDur = 86400 * 60;
		dil = await Dilithium.new(decayHaltFee, decayDur);

		ltn = await Latinum.new(dil.address, { from: accounts[0] });

		await dil.setLTNAddress(ltn.address);
	});

	describe(".mint", async function () {
		it("should mint successfully", async () => {
			const res = await ltn.mint(accounts[1], 100);
			const bal = await ltn.balanceOf(accounts[1]);
			expect(bal.toNumber()).to.equal(100);
		});

		it("should revert if sender is not the owner", async () => {
			await truffleAssert.reverts(
				ltn.mint(accounts[1], 100, { from: accounts[1] }),
				"Sender is not owner",
			);
		});

		it("should revert if amount will cause max supply to be exceeded", async () => {
			await ltn.mint(accounts[1], "150000000000000000000000000");
			await truffleAssert.reverts(ltn.mint(accounts[1], 1), "Cannot exceed max supply");
		});
	});

	describe(".setOwnerOnce", () => {
		it("should revert if sender is not the current/default owner", async () => {
			expect(await ltn.owner()).to.equal(accounts[0]);
			await truffleAssert.reverts(
				ltn.setOwnerOnce(accounts[1], { from: accounts[2] }),
				"Sender is not owner",
			);
		});

		it("should change the owner if the method has not be called before", async () => {
			expect(await ltn.owner()).to.equal(accounts[0]);
			const res = await ltn.setOwnerOnce(accounts[1]);
			expect(await ltn.owner()).to.equal(accounts[1]);
		});

		it("should revert if the method has already been called before", async () => {
			expect(await ltn.owner()).to.equal(accounts[0]);
			const res = await ltn.setOwnerOnce(accounts[1]);
			expect(await ltn.owner()).to.equal(accounts[1]);
			await truffleAssert.reverts(
				ltn.setOwnerOnce(accounts[0], { from: accounts[1] }),
				"Owner already set",
			);
		});
	});
});
