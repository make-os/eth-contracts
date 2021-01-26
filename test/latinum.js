const Latinum = artifacts.require("Latinum");
const truffleAssert = require("truffle-assertions");

contract("Latinum", (accounts) => {
	let ins;
	beforeEach(async () => {
		ins = await Latinum.new({ from: accounts[0] });
	});

	describe(".mint", async function () {
		it("should mint successfully", async () => {
			const res = await ins.mint(accounts[1], 100);
			expect(res.logs).to.have.lengthOf(1);
			expect(res.logs[0].event).to.equal("Transfer");
			expect(res.logs[0].args.from).to.equal(
				"0x0000000000000000000000000000000000000000",
			);
			expect(res.logs[0].args.to).to.equal(accounts[1]);
			expect(res.logs[0].args.value.toNumber()).to.equal(100);
		});

		it("should revert if sender is not the owner", async () => {
			await truffleAssert.reverts(
				ins.mint(accounts[1], 100, { from: accounts[1] }),
				"Sender is not owner",
			);
		});

		it("should revert if amount will cause max supply to be exceeded", async () => {
			await ins.mint(accounts[1], "150000000000000000000000000");
			await truffleAssert.reverts(ins.mint(accounts[1], 1), "Cannot exceed max supply");
		});
	});

	describe(".setOwnerOnce", () => {
		it("should revert if sender is not the current/default owner", async () => {
			expect(await ins.owner()).to.equal(accounts[0]);
			await truffleAssert.reverts(
				ins.setOwnerOnce(accounts[1], { from: accounts[2] }),
				"Sender is not owner",
			);
		});

		it("should change the owner if the method has not be called before", async () => {
			expect(await ins.owner()).to.equal(accounts[0]);
			const res = await ins.setOwnerOnce(accounts[1]);
			expect(await ins.owner()).to.equal(accounts[1]);
		});

		it("should revert if the method has already been called before", async () => {
			expect(await ins.owner()).to.equal(accounts[0]);
			const res = await ins.setOwnerOnce(accounts[1]);
			expect(await ins.owner()).to.equal(accounts[1]);
			await truffleAssert.reverts(
				ins.setOwnerOnce(accounts[0], { from: accounts[1] }),
				"Owner already set",
			);
		});
	});
});
