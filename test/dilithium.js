const Dilithium = artifacts.require("Dilithium");
const truffleAssert = require("truffle-assertions");

contract("Dilithium", (accounts) => {
	let ins;
	beforeEach(async () => {
		ins = await Dilithium.new({ from: accounts[0] });
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
	});

	describe(".burn", async function () {
		it("should burn balance successfully", async () => {
			const res = await ins.mint(accounts[1], 100);
			let bal = (await ins.balanceOf(accounts[1])).toNumber();
			expect(bal).to.equal(100);

			await ins.burn(100, { from: accounts[1] });
			bal = (await ins.balanceOf(accounts[1])).toNumber();
			expect(bal).to.equal(0);
		});
	});
});
