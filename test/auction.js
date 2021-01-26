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
	let ins, dil;
	let ltnSupplyPerPeriod;
	let maxPeriods;
	let minBid;

	beforeEach(async () => {
		ltnSupplyPerPeriod = 100;
		maxPeriods = 2;
		minBid = 100;

		dil = await Dilithium.new({ from: accounts[0] });
		ins = await Auction.new(dil.address, maxPeriods, ltnSupplyPerPeriod, minBid);
	});

	describe(".makePeriod", async function () {
		describe("when no period exists", () => {
			it("should emit 'NewAuctionPeriod' event, add a new period and set its endTime to next 24 hours", async () => {
				await advanceTime(0);
				ins = await Auction.new(dil.address, maxPeriods, ltnSupplyPerPeriod, minBid);
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
				ins = await Auction.new(dil.address, maxPeriods, ltnSupplyPerPeriod, minBid);
				let res = await ins.makePeriod();

				expect((await ins.getNumOfPeriods()).toNumber()).to.equal(1);
				const period = await ins.periods(0);
				const endTime = dayjs.unix(period.endTime.toNumber());
				const now = dayjs();
				expect(endTime.unix() - now.unix()).to.be.at.least(86390);
			});

			it("should add a new period and set LTN supply", async () => {
				await advanceTime(0);
				ins = await Auction.new(dil.address, maxPeriods, ltnSupplyPerPeriod, minBid);
				let res = await ins.makePeriod();

				expect((await ins.getNumOfPeriods()).toNumber()).to.equal(1);
				const period = await ins.periods(0);
				expect(period.ltnSupply.toNumber()).to.equal(ltnSupplyPerPeriod);
			});
		});

		it("should not add another period if the last period has not ended", async () => {
			await advanceTime(0);
			ins = await Auction.new(dil.address, maxPeriods, ltnSupplyPerPeriod, minBid);
			let res = await ins.makePeriod();

			await ins.makePeriod();
			expect((await ins.getNumOfPeriods()).toNumber()).to.equal(1);
		});

		it("should revert with 'Auction has closed' if max number periods have been created", async () => {
			await advanceTime(0);
			ins = await Auction.new(dil.address, maxPeriods, ltnSupplyPerPeriod, minBid);
			let res = await ins.makePeriod();

			await advanceTime(86400);
			await ins.makePeriod();
			expect((await ins.getNumOfPeriods()).toNumber()).to.equal(2);

			await advanceTime(86400);
			await truffleAssert.reverts(ins.makePeriod(), "Auction has closed");
		});
	});

	function unlock(account, amount) {
		return new Promise(async (res, rej) => {
			try {
				// approve bid amount
				await dil.mint(account, amount);
				expect((await dil.balanceOf(account)).toNumber()).to.equal(amount);
				await dil.approve(ins.address, amount, { from: account });
				expect((await dil.allowance(account, ins.address)).toNumber()).to.equal(amount);
				res();
			} catch (error) {
				rej(error);
			}
		});
	}

	function bid(account, amount) {
		return new Promise(async (res, rej) => {
			try {
				await ins.bid(amount, { from: account });
				res();
			} catch (error) {
				rej(error);
			}
		});
	}

	describe(".bid", () => {
		it("should revert with 'Auction has closed' if auction has closed (last period ended)", async () => {
			maxPeriods = 1;
			ins = await Auction.new(dil.address, maxPeriods, ltnSupplyPerPeriod, minBid);
			let res = await ins.makePeriod();
			await advanceTime(86600);
			await truffleAssert.reverts(ins.bid(1000), "Auction has closed");
		});

		it("should revert with 'Amount not unlocked' if bid amount has not been unlocked", async () => {
			maxPeriods = 1;
			ins = await Auction.new(dil.address, maxPeriods, ltnSupplyPerPeriod, minBid);
			await truffleAssert.reverts(ins.bid(1000), "Amount not unlocked");
		});

		it("should revert with 'Bid amount too small' if bid amount is <= minBid", async () => {
			maxPeriods = 1;
			minBid = 1000;
			ins = await Auction.new(dil.address, maxPeriods, ltnSupplyPerPeriod, minBid);

			await unlock(accounts[1], 999);

			await truffleAssert.reverts(
				ins.bid(0, { from: accounts[1] }),
				"Bid amount too small",
			);
			await truffleAssert.reverts(
				ins.bid(999, { from: accounts[1] }),
				"Bid amount too small",
			);
		});

		describe("when bidder unlocked the bid amount", () => {
			beforeEach(async () => {
				maxPeriods = 1;
				ins = await Auction.new(dil.address, maxPeriods, ltnSupplyPerPeriod, minBid);

				await unlock(accounts[1], 1000);

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
				ins = await Auction.new(dil.address, maxPeriods, ltnSupplyPerPeriod, minBid);

				await unlock(accounts[1], 1500);

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

		describe("when an account has more than 5 unprocessed claims", () => {
			it("should revert with 'Too many unprocessed claims'", async () => {
				ins = await Auction.new(dil.address, maxPeriods, ltnSupplyPerPeriod, minBid);
				await unlock(accounts[1], 600);
				await bid(accounts[1], 100);
				await bid(accounts[1], 100);
				await bid(accounts[1], 100);
				await bid(accounts[1], 100);
				await bid(accounts[1], 100);
				expect((await ins.getNumOfClaims({ from: accounts[1] })).toNumber()).to.equal(5);
				await truffleAssert.reverts(bid(accounts[1], 100), "Too many unprocessed claims");
			});
		});
	});

	describe(".claim", () => {
		beforeEach(() => {
			maxPeriods = 2;
			ltnSupplyPerPeriod = 1000;
			minBid = 100;
		});

		describe("within a period", () => {
			describe("when only one bid is received", () => {
				it("should allocate all period supply to the only bidder", async () => {
					ins = await Auction.new(dil.address, maxPeriods, ltnSupplyPerPeriod, minBid);
					await unlock(accounts[1], 500);
					await bid(accounts[1], 500);
					await advanceTime(86500);
					await ins.claim({ from: accounts[1] });
					expect((await ins.balanceOf(accounts[1])).toNumber()).to.equal(1000);

					// should have zero claims
					expect((await ins.getNumOfClaims({ from: accounts[1] })).toNumber()).to.equal(
						0,
					);
				});

				it("should not allocate period supply when period has not ended", async () => {
					ins = await Auction.new(dil.address, maxPeriods, ltnSupplyPerPeriod, minBid);
					await unlock(accounts[1], 500);
					await bid(accounts[1], 500);
					await ins.claim({ from: accounts[1] });
					expect((await ins.balanceOf(accounts[1])).toNumber()).to.equal(0);

					// should have one claim
					expect((await ins.getNumOfClaims({ from: accounts[1] })).toNumber()).to.equal(
						1,
					);
				});
			});

			describe("when there are two bids from same account", () => {
				it("should allocate 100% of period supply to the only bidder", async () => {
					ins = await Auction.new(dil.address, maxPeriods, ltnSupplyPerPeriod, minBid);
					await unlock(accounts[1], 1200);
					await bid(accounts[1], 500);
					await bid(accounts[1], 700);
					await advanceTime(86500);
					await ins.claim({ from: accounts[1] });
					expect((await ins.balanceOf(accounts[1])).toNumber()).to.equal(999);

					// should have zero claims
					expect((await ins.getNumOfClaims({ from: accounts[1] })).toNumber()).to.equal(
						0,
					);
				});
			});

			describe("when there are three bids from different accounts", () => {
				it("should respectively allocate 357,500,142 of period supply account 1,2,3", async () => {
					ins = await Auction.new(dil.address, maxPeriods, ltnSupplyPerPeriod, minBid);
					await unlock(accounts[1], 500);
					await bid(accounts[1], 500);
					await unlock(accounts[2], 700);
					await bid(accounts[2], 700);
					await unlock(accounts[3], 200);
					await bid(accounts[3], 200);
					await advanceTime(86500);
					await ins.claim({ from: accounts[1] });
					await ins.claim({ from: accounts[2] });
					await ins.claim({ from: accounts[3] });
					expect((await ins.balanceOf(accounts[1])).toNumber()).to.equal(357);
					expect((await ins.balanceOf(accounts[2])).toNumber()).to.equal(500);
					expect((await ins.balanceOf(accounts[3])).toNumber()).to.equal(142);

					// should have zero claims for all claimed accounts
					expect((await ins.getNumOfClaims({ from: accounts[1] })).toNumber()).to.equal(
						0,
					);
					expect((await ins.getNumOfClaims({ from: accounts[2] })).toNumber()).to.equal(
						0,
					);
					expect((await ins.getNumOfClaims({ from: accounts[3] })).toNumber()).to.equal(
						0,
					);
				});
			});

			describe("when an account claims are deleted, other account claims should not be affected", () => {
				it("should not affect other account claims", async () => {
					ins = await Auction.new(dil.address, maxPeriods, ltnSupplyPerPeriod, minBid);
					await unlock(accounts[1], 500);
					await bid(accounts[1], 500);
					await unlock(accounts[2], 700);
					await bid(accounts[2], 700);
					await unlock(accounts[3], 200);
					await bid(accounts[3], 200);
					await advanceTime(86500);
					await ins.claim({ from: accounts[1] });
					expect((await ins.balanceOf(accounts[1])).toNumber()).to.equal(357);
					expect((await ins.balanceOf(accounts[2])).toNumber()).to.equal(0);
					expect((await ins.balanceOf(accounts[3])).toNumber()).to.equal(0);

					// should have zero claims for account 1
					expect((await ins.getNumOfClaims({ from: accounts[1] })).toNumber()).to.equal(
						0,
					);

					// should have one claim for account 2
					expect((await ins.getNumOfClaims({ from: accounts[2] })).toNumber()).to.equal(
						1,
					);

					// should have one claim for account 3
					expect((await ins.getNumOfClaims({ from: accounts[3] })).toNumber()).to.equal(
						1,
					);
				});
			});
		});

		describe("within two or more periods", () => {
			describe("when only one bid is received per period", () => {
				it("should allocate 100% of both periods supply to the only bidder", async () => {
					ins = await Auction.new(dil.address, maxPeriods, ltnSupplyPerPeriod, minBid);
					await unlock(accounts[1], 1000);
					await bid(accounts[1], 500);
					advanceTime(86500);
					await bid(accounts[1], 500);
					await advanceTime(86500);
					expect((await ins.getNumOfPeriods()).toNumber()).to.equal(2);
					await ins.claim({ from: accounts[1] });
					expect((await ins.balanceOf(accounts[1])).toNumber()).to.equal(2000);

					expect((await ins.getNumOfClaims({ from: accounts[1] })).toNumber()).to.equal(
						0,
					);
				});
			});
		});
	});
});
