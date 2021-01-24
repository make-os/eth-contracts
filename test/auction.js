const Latinum = artifacts.require("Latinum");
const Dilithium = artifacts.require("Dilithium");
const Auction = artifacts.require("Auction");
const truffleAssert = require("truffle-assertions");
const dayjs = require("dayjs");
const duration = require("dayjs/plugin/duration");
dayjs.extend(duration);

advanceTime = (time) => {
	return new Promise((resolve, reject) => {
		web3.currentProvider.send(
			{
				jsonrpc: "2.0",
				method: "evm_increaseTime",
				params: [time],
				id: new Date().getTime(),
			},
			(err, result) => {
				if (err) {
					return reject(err);
				}
				return resolve(result);
			},
		);
	});
};

contract("Auction", (accounts) => {
	let ins, ltn, dil;
	let ltnSupplyPerPeriod = 100;
	let maxPeriods = 2;

	beforeEach(async () => {
		ltn = await Latinum.new({ from: accounts[0] });
		dil = await Dilithium.new({ from: accounts[0] });
		ins = await Auction.new(ltn.address, dil.address, maxPeriods, ltnSupplyPerPeriod);
	});

	describe(".makePeriod", async function () {
		describe("when no period exists", () => {
			it("should emit 'NewAuctionPeriod' event, add a new period and set its endTime to next 24 hours", async () => {
				await advanceTime(0);
				ins = await Auction.new(ltn.address, dil.address, maxPeriods, ltnSupplyPerPeriod);
				let res = await ins.makePeriod();

				expect(res.logs[0].event).to.equal("NewAuctionPeriod");
				expect(res.logs).to.have.lengthOf(1);
				expect(res.logs[0].args.index.toNumber()).to.equal(0);
				const endTime = dayjs.unix(res.logs[0].args.endTime.toNumber());
				const now = dayjs();
				expect(endTime.unix() - now.unix()).to.be.at.least(86390);
			});

			it("should add a new period and set LTN supply", async () => {
				await advanceTime(0);
				ins = await Auction.new(ltn.address, dil.address, maxPeriods, ltnSupplyPerPeriod);
				let res = await ins.makePeriod();

				expect((await ins.getNumOfPeriods()).toNumber()).to.equal(1);
				const period = await ins.periods(0);
				const endTime = dayjs.unix(period.endTime.toNumber());
				const now = dayjs();
				expect(endTime.unix() - now.unix()).to.be.at.least(86390);
			});

			it("should add a new period and set LTN supply", async () => {
				await advanceTime(0);
				ins = await Auction.new(ltn.address, dil.address, maxPeriods, ltnSupplyPerPeriod);
				let res = await ins.makePeriod();

				expect((await ins.getNumOfPeriods()).toNumber()).to.equal(1);
				const period = await ins.periods(0);
				expect(period.ltnSupply.toNumber()).to.equal(ltnSupplyPerPeriod);
			});
		});

		it("should not add another period if the last period has not ended", async () => {
			await advanceTime(0);
			ins = await Auction.new(ltn.address, dil.address, maxPeriods, ltnSupplyPerPeriod);
			let res = await ins.makePeriod();

			await ins.makePeriod();
			expect((await ins.getNumOfPeriods()).toNumber()).to.equal(1);
		});

		it("should revert with 'Auction has closed' if max number periods have been created", async () => {
			await advanceTime(0);
			ins = await Auction.new(ltn.address, dil.address, maxPeriods, ltnSupplyPerPeriod);
			let res = await ins.makePeriod();

			await advanceTime(86400);
			await ins.makePeriod();
			expect((await ins.getNumOfPeriods()).toNumber()).to.equal(2);

			await advanceTime(86400);
			await truffleAssert.reverts(ins.makePeriod(), "Auction has closed");
		});
	});

	describe(".bid", () => {
		it("should revert with 'Auction has closed' if auction has closed (last period ended)", async () => {
			maxPeriods = 1;
			ins = await Auction.new(ltn.address, dil.address, maxPeriods, ltnSupplyPerPeriod);
			let res = await ins.makePeriod();
			await advanceTime(86600);
			await truffleAssert.reverts(ins.bid(1000), "Auction has closed");
		});

		it("should revert with 'Amount not unlocked' if bid amount has not been unlocked", async () => {
			maxPeriods = 1;
			ins = await Auction.new(ltn.address, dil.address, maxPeriods, ltnSupplyPerPeriod);
			await truffleAssert.reverts(ins.bid(1000), "Amount not unlocked");
		});

		it("should revert with 'Bid amount too small' if bid amount is <= 0", async () => {
			maxPeriods = 1;
			ins = await Auction.new(ltn.address, dil.address, maxPeriods, ltnSupplyPerPeriod);
			await truffleAssert.reverts(ins.bid(0), "Bid amount too small");
		});

		describe("when bidder unlocked the bid amount", () => {
			beforeEach(async () => {
				maxPeriods = 1;
				ins = await Auction.new(ltn.address, dil.address, maxPeriods, ltnSupplyPerPeriod);

				// approve bid amount
				await dil.mint(accounts[1], 1000);
				expect((await dil.balanceOf(accounts[1])).toNumber()).to.equal(1000);
				await dil.approve(ins.address, 1000, { from: accounts[1] });
				expect((await dil.allowance(accounts[1], ins.address)).toNumber()).to.equal(1000);

				// place bid
				await ins.bid(1000, { from: accounts[1] });
			});

			it("should create a period", async () => {
				expect((await ins.getNumOfPeriods()).toNumber()).to.equal(1);
				const period = await ins.periods(0);
				expect(period.ltnSupply.toNumber()).to.equal(ltnSupplyPerPeriod);
				expect(period.totalBids.toNumber()).to.equal(1000);
			});

			it("should add a claim", async () => {
				expect((await ins.getNumOfClaims({ from: accounts[1] })).toNumber()).to.equal(1);
				const claim = await ins.claims(accounts[1], 0);
				expect(claim.period.toNumber()).to.equal(0);
				expect(claim.bid.toNumber()).to.equal(1000);
			});

			it("should destroy bid amount from sender DIL balance", async () => {
				expect((await dil.allowance(accounts[1], ins.address)).toNumber()).to.equal(0);
				expect((await dil.balanceOf(accounts[1])).toNumber()).to.equal(0);
			});
		});

		describe("when sender bids thrice. 2 in same period and 1 in another period", () => {
			beforeEach(async () => {
				maxPeriods = 2;
				ins = await Auction.new(ltn.address, dil.address, maxPeriods, ltnSupplyPerPeriod);

				// approve bid amount
				await dil.mint(accounts[1], 1500);
				expect((await dil.balanceOf(accounts[1])).toNumber()).to.equal(1500);
				await dil.approve(ins.address, 1500, { from: accounts[1] });
				expect((await dil.allowance(accounts[1], ins.address)).toNumber()).to.equal(1500);

				// place bids
				await ins.bid(500, { from: accounts[1] });
				await ins.bid(500, { from: accounts[1] });
				await advanceTime(86500);
				await ins.bid(500, { from: accounts[1] });
			});

			it("should create a period", async () => {
				expect((await ins.getNumOfPeriods()).toNumber()).to.equal(2);
				let period = await ins.periods(0);
				expect(period.ltnSupply.toNumber()).to.equal(ltnSupplyPerPeriod);
				expect(period.totalBids.toNumber()).to.equal(1000);

				period = await ins.periods(1);
				expect(period.ltnSupply.toNumber()).to.equal(ltnSupplyPerPeriod);
				expect(period.totalBids.toNumber()).to.equal(500);
			});

			it("should add three claims of 500 each for the sender", async () => {
				expect((await ins.getNumOfClaims({ from: accounts[1] })).toNumber()).to.equal(3);
				let claim = await ins.claims(accounts[1], 0);
				expect(claim.period.toNumber()).to.equal(0);
				expect(claim.bid.toNumber()).to.equal(500);

				claim = await ins.claims(accounts[1], 1);
				expect(claim.period.toNumber()).to.equal(0);
				expect(claim.bid.toNumber()).to.equal(500);

				claim = await ins.claims(accounts[1], 2);
				expect(claim.period.toNumber()).to.equal(1);
				expect(claim.bid.toNumber()).to.equal(500);
			});
		});
	});
});
