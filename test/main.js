const Main = artifacts.require("Main");
const Latinum = artifacts.require("Latinum");
const Auction = artifacts.require("Auction");
const Dilithium = artifacts.require("Dilithium");
const ELL = artifacts.require("../contracts/libs/ell/EIP20.sol");
const truffleAssert = require("truffle-assertions");

contract("Main", (accounts) => {
	let main, ell, dil, auc;
	beforeEach(async () => {
		ell = await ELL.new("150000000000", "Ellcrys Network Token", 18, "ELL", {
			from: accounts[3],
		});

		dil = await Dilithium.new({ from: accounts[0] });

		auc = await Auction.new(dil.address, 1, 100, 1000, {
			from: accounts[0],
		});

		main = await Main.new(ell.address, dil.address, auc.address, { from: accounts[0] });
		await auc.setOwnerOnce(main.address, { from: accounts[0] });
	});

	describe(".swapELL", async function () {
		it("should revert with 'Sender is not owner' when sender is not an owner", async () => {
			await truffleAssert.reverts(
				main.swapELL(accounts[1], 100, 100, { from: accounts[1] }),
				"Sender is not owner",
			);
		});

		it("should revert with 'Swap amount not unlocked' when ELL owner has not unlocked the swap amount in the ELL contract", async () => {
			await truffleAssert.reverts(
				main.swapELL(accounts[1], 100, 100),
				"Swap amount not unlocked",
			);
		});

		it("should revert with 'Swap amount not unlocked' when attempting to swap more than the allowed amount", async () => {
			await ell.approve(main.address, 100, { from: accounts[3] });
			await truffleAssert.reverts(
				main.swapELL(accounts[1], 101, 100),
				"Swap amount not unlocked",
			);
		});

		describe("when swap amount is == approved ELL amount", () => {
			it("should reduce ELL owner's balance and mint LTN of exact swap amount", async () => {
				await ell.approve(main.address, 100, { from: accounts[3] });
				const res = await main.swapELL(accounts[3], 100, 100);
				let ellBal = await ell.balanceOf(accounts[3]);
				expect(ellBal.toString()).to.equal("149999999900");
				let ltn = await Auction.at(await main.auc());
				let ltnBal = await ltn.balanceOf(accounts[3]);
				expect(ltnBal.toNumber()).to.equal(100);

				expect(res.logs).to.have.lengthOf(1);
				expect(res.logs[0].event).to.equal("SwappedELL");
			});
		});

		describe("when swap amount is < approved ELL amount", () => {
			beforeEach(async () => {
				await ell.approve(main.address, 100, { from: accounts[3] });
				await main.swapELL(accounts[3], 50, 100);
			});

			it("should reduce ELL owner's balance and mint LTN of exact swap amount", async () => {
				let ellBal = await ell.balanceOf(accounts[3]);
				expect(ellBal.toString()).to.equal("149999999950");
				let ltn = await Auction.at(await main.auc());
				let ltnBal = await ltn.balanceOf(accounts[3]);
				expect(ltnBal.toNumber()).to.equal(100);
			});

			it("should use up the remaining approved ELL", async () => {
				await ell.approve(main.address, 100, { from: accounts[3] });
				const res = await main.swapELL(accounts[3], 50, 100);
				let ellBal = await ell.balanceOf(accounts[3]);
				expect(ellBal.toString()).to.equal("149999999900");
				let ltn = await Auction.at(await main.auc());
				let ltnBal = await ltn.balanceOf(accounts[3]);
				expect(ltnBal.toNumber()).to.equal(200);

				expect(res.logs).to.have.lengthOf(1);
				expect(res.logs[0].event).to.equal("SwappedELL");
			});
		});
	});
});
