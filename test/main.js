const Main = artifacts.require("Main");
const Latinum = artifacts.require("Latinum");
const Auction = artifacts.require("Auction");
const Dilithium = artifacts.require("Dilithium");
const ELL = artifacts.require("../contracts/libs/ell/EIP20.sol");
const truffleAssert = require("truffle-assertions");

contract("Main", (accounts) => {
	let main, ell, dil, auc;
	let ltnSupplyPerPeriod, maxPeriods, minBid, minDILSupply, maxSwappableELL, fundingAddr;

	beforeEach(async () => {
		ltnSupplyPerPeriod = 100;
		maxPeriods = 1;
		minBid = 100;
		minDILSupply = 100;

		ell = await ELL.new("150000000000", "Ellcrys Network Token", 18, "ELL", {
			from: accounts[3],
		});

		dil = await Dilithium.new({ from: accounts[0] });

		auc = await Auction.new(
			dil.address,
			minDILSupply,
			maxPeriods,
			ltnSupplyPerPeriod,
			minBid,
			{ from: accounts[0] },
		);

		maxSwappableELL = 10000;
		fundingAddr = accounts[5];
		main = await Main.new(
			maxSwappableELL,
			ell.address,
			dil.address,
			auc.address,
			fundingAddr,
			{
				from: accounts[0],
			},
		);
		await auc.setOwnerOnce(main.address, { from: accounts[0] });
	});

	describe(".setFundingAddress", async function () {
		it("should revert if sender is not owner", async () => {
			await truffleAssert.reverts(
				main.setFundingAddress(accounts[6], { from: accounts[2] }),
				"Sender is not owner",
			);
		});

		it("should set new address if sender is owner", async () => {
			expect(await main.fundingAddress()).to.equal(accounts[5]);
			await main.setFundingAddress(accounts[6], { from: accounts[0] });
			expect(await main.fundingAddress()).to.equal(accounts[6]);
		});
	});

	describe.only(".withdraw", () => {
		it("should revert with 'Sender not the funding address' if sender is not the funding address", async () => {
			expect(await main.fundingAddress()).to.equal(accounts[5]);
			await truffleAssert.reverts(
				main.withdraw(1000, { from: accounts[0] }),
				"Sender not the funding address",
			);
		});

		it("should revert with 'Transfer failed' if contract balance is less than amount", async () => {
			expect(await main.fundingAddress()).to.equal(accounts[5]);
			await truffleAssert.reverts(
				main.withdraw(1000, { from: accounts[5] }),
				"Transfer failed",
			);
		});

		it("should successfully transfer amount if contract balance is sufficient", async () => {
			// send eth to contract
			await main.sendTransaction({ from: accounts[0], value: web3.utils.toWei("10") });
			expect(await web3.eth.getBalance(main.address)).to.equal(web3.utils.toWei("10"));

			// get eth balance of funding address
			let fundingAddrBal = await web3.eth.getBalance(accounts[5]);

			// withdraw into funding address
			await main.withdraw(web3.utils.toWei("5"), { from: accounts[5] });

			// check that contract balance reduced
			expect(await web3.eth.getBalance(main.address)).to.equal(web3.utils.toWei("5"));

			// check that funding address increase
			let curFundingAddrBal = await web3.eth.getBalance(accounts[5]);
			expect(new web3.utils.BN(fundingAddrBal).lt(new web3.utils.BN(curFundingAddrBal)))
				.to.be.true;
		});
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
				expect((await main.swapped()).toNumber()).to.equal(100);

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
				expect((await main.swapped()).toNumber()).to.equal(100);
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

		describe("test max. swap supply limit", () => {
			beforeEach(async () => {
				await ell.approve(main.address, 9999, { from: accounts[3] });
				await main.swapELL(accounts[3], 9999, 9999);
				expect((await main.swapped()).toNumber()).to.equal(9999);
			});

			it("should revert with 'Total swappable ELL reached' if swap will cause max. swappable supply to be exceeded", async () => {
				await ell.approve(main.address, 2, { from: accounts[3] });
				await truffleAssert.reverts(
					main.swapELL(accounts[3], 2, 2),
					"Total swappable ELL reached",
				);
			});

			it("should not revert if swap will not cause max. swappable supply to be exceeded", async () => {
				await ell.approve(main.address, 2, { from: accounts[3] });
				await main.swapELL(accounts[3], 1, 1);
			});
		});
	});
});
