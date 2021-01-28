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

	describe(".offBurning", () => {
		it("should revert if sender is not owner", async () => {
			await truffleAssert.reverts(
				ins.offBurning({ from: accounts[1] }),
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

		it("should revert if burning is disabled", async () => {
			const res = await ins.mint(accounts[1], 100);
			let bal = (await ins.balanceOf(accounts[1])).toNumber();
			expect(bal).to.equal(100);

			await ins.offBurning();
			await truffleAssert.reverts(ins.burn(100, { from: accounts[1] }), "Burn disabled");

			bal = (await ins.balanceOf(accounts[1])).toNumber();
			expect(bal).to.equal(100);
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
