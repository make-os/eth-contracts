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
	let ltnSupplyPerPeriod, minDILSupply, maxPeriods, minBid, fundingAddr, auctionFee;

	beforeEach(async () => {
		curBlockTime = await utils.getCurrentBlockTime();

		dil = await Dilithium.new();

		ltnSupplyPerPeriod = 100;
		maxPeriods = 2;
		minBid = 100;
		minDILSupply = 100;
		fundingAddr = accts[5];
		auctionFee = 0;
		ltn = await Auction.new(
			dil.address,
			minDILSupply,
			maxPeriods,
			ltnSupplyPerPeriod,
			minBid,
			fundingAddr,
			auctionFee,
		);
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

	describe(".setOwner", () => {
		it("should revert if sender is not the current/default owner", async () => {
			expect(await dil.owner()).to.equal(accts[0]);
			await truffleAssert.reverts(
				dil.setOwner(accts[1], { from: accts[2] }),
				"Sender is not owner",
			);
		});

		it("should change the owner if the method has not be called before", async () => {
			expect(await dil.owner()).to.equal(accts[0]);
			const res = await dil.setOwner(accts[1]);
			expect(await dil.owner()).to.equal(accts[1]);
		});
	});

	describe(".burnForMainnet", () => {
		it("should burn balance and emit event", async () => {
			await dil.mint(accts[1], web3.utils.toWei("10"));
			let mainnetAddr = Buffer.from("some_addr");
			const res = await dil.burnForMainnet(mainnetAddr, { from: accts[1] });
			let bal = await dil.balanceOf(accts[1]);
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
