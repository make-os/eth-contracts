const Dilithium = artifacts.require("Dilithium");
const Auction = artifacts.require("Auction");
const truffleAssert = require("truffle-assertions");
const dayjs = require("dayjs");
const duration = require("dayjs/plugin/duration");
const utils = require("./utils");
const { expect } = require("chai");
dayjs.extend(duration);

contract("Auction", (accts) => {
	let auc, dil;
	let ltnSupplyPerPeriod, minDILSupply, maxPeriods, minBid, auctionFee, fundingAddr;

	beforeEach(async () => {
		dil = await Dilithium.new({ from: accts[0] });

		ltnSupplyPerPeriod = 100;
		maxPeriods = 2;
		minBid = 100;
		minDILSupply = 100;
		fundingAddr = accts[5];
		auctionFee = 0;
		auc = await Auction.new(
			dil.address,
			minDILSupply,
			maxPeriods,
			ltnSupplyPerPeriod,
			minBid,
			fundingAddr,
			auctionFee,
		);
	});

	describe(".makePeriod", async function () {
		describe("when no period exists", () => {
			it("should revert with 'Minimum Dilithium supply not reached' when total DIL supply is less than the minimum required supply", async () => {
				await utils.advanceTime(0);
				auc = await Auction.new(
					dil.address,
					minDILSupply,
					maxPeriods,
					ltnSupplyPerPeriod,
					minBid,
					fundingAddr,
					auctionFee,
				);
				await truffleAssert.reverts(
					auc.makePeriod(),
					"Minimum Dilithium supply not reached",
				);
			});

			it("should emit 'NewPeriod' event, add a new period and set its endTime to next 24 hours", async () => {
				await utils.advanceTime(0);
				auc = await Auction.new(
					dil.address,
					minDILSupply,
					maxPeriods,
					ltnSupplyPerPeriod,
					minBid,
					fundingAddr,
					auctionFee,
				);

				await dil.mint(accts[0], minDILSupply);
				let res = await auc.makePeriod();

				expect(res.logs[0].event).to.equal("NewPeriod");
				expect(res.logs).to.have.lengthOf(1);
				expect(res.logs[0].args.index.toNumber()).to.equal(0);
				const endTime = dayjs.unix(res.logs[0].args.endTime.toNumber());
				const now = dayjs();
				expect(endTime.unix() - now.unix()).to.be.at.least(86390);
				expect((await auc.getNumOfPeriods()).toNumber()).to.equal(1);
			});

			it("should add a new period and set LTN supply", async () => {
				await utils.advanceTime(0);
				auc = await Auction.new(
					dil.address,
					minDILSupply,
					maxPeriods,
					ltnSupplyPerPeriod,
					minBid,
					fundingAddr,
					auctionFee,
				);

				await dil.mint(accts[0], minDILSupply);
				let res = await auc.makePeriod();

				expect((await auc.getNumOfPeriods()).toNumber()).to.equal(1);
				const period = await auc.periods(0);
				expect(period.ltnSupply.toNumber()).to.equal(ltnSupplyPerPeriod);
			});
		});

		it("should not add another period if the last period has not ended", async () => {
			await utils.advanceTime(0);
			auc = await Auction.new(
				dil.address,
				minDILSupply,
				maxPeriods,
				ltnSupplyPerPeriod,
				minBid,
				fundingAddr,
				auctionFee,
			);

			await dil.mint(accts[0], minDILSupply);
			let res = await auc.makePeriod();

			await auc.makePeriod();
			expect((await auc.getNumOfPeriods()).toNumber()).to.equal(1);
		});

		it("should revert with 'Auction has closed' if max number periods have been created", async () => {
			await utils.advanceTime(0);
			auc = await Auction.new(
				dil.address,
				minDILSupply,
				maxPeriods,
				ltnSupplyPerPeriod,
				minBid,
				fundingAddr,
				auctionFee,
			);

			await dil.mint(accts[0], minDILSupply);
			let res = await auc.makePeriod();

			await utils.advanceTime(86400);
			await auc.makePeriod();
			expect((await auc.getNumOfPeriods()).toNumber()).to.equal(2);

			await utils.advanceTime(86400);
			await truffleAssert.reverts(auc.makePeriod(), "Auction has closed");
		});
	});

	function unlock(account, amount) {
		return new Promise(async (res, rej) => {
			try {
				// approve bid amount
				await dil.mint(account, amount);
				expect((await dil.balanceOf(account)).toNumber()).to.equal(amount);
				await dil.approve(auc.address, amount, { from: account });
				expect((await dil.allowance(account, auc.address)).toNumber()).to.equal(amount);
				res();
			} catch (error) {
				rej(error);
			}
		});
	}

	function bid(account, amount, value) {
		return new Promise(async (res, rej) => {
			try {
				let opt = { from: account };
				if (value) {
					opt.value = value;
				}
				await auc.bid(amount, opt);
				res();
			} catch (error) {
				rej(error);
			}
		});
	}

	describe(".bid", () => {
		it("should revert with 'Auction has closed' if auction has closed (last period ended)", async () => {
			maxPeriods = 1;
			auc = await Auction.new(
				dil.address,
				minDILSupply,
				maxPeriods,
				ltnSupplyPerPeriod,
				minBid,
				fundingAddr,
				auctionFee,
			);

			await dil.mint(accts[0], minDILSupply);
			let res = await auc.makePeriod();
			await utils.advanceTime(86600);
			await truffleAssert.reverts(auc.bid(1000), "Auction has closed");
		});

		it("should revert with 'Amount not unlocked' if bid amount has not been unlocked", async () => {
			maxPeriods = 1;
			auc = await Auction.new(
				dil.address,
				minDILSupply,
				maxPeriods,
				ltnSupplyPerPeriod,
				minBid,
				fundingAddr,
				auctionFee,
			);
			await truffleAssert.reverts(auc.bid(1000), "Amount not unlocked");
		});

		it("should revert with 'Bid amount too small' if bid amount is <= minBid", async () => {
			maxPeriods = 1;
			minBid = 1000;
			auc = await Auction.new(
				dil.address,
				minDILSupply,
				maxPeriods,
				ltnSupplyPerPeriod,
				minBid,
				fundingAddr,
				auctionFee,
			);

			await unlock(accts[1], 999);

			await truffleAssert.reverts(auc.bid(0, { from: accts[1] }), "Bid amount too small");
			await truffleAssert.reverts(
				auc.bid(999, { from: accts[1] }),
				"Bid amount too small",
			);
		});

		it("should revert with 'Bid amount too high' if bid amount is > minBid * 10", async () => {
			maxPeriods = 1;
			minBid = 1000;
			auc = await Auction.new(
				dil.address,
				minDILSupply,
				maxPeriods,
				ltnSupplyPerPeriod,
				minBid,
				fundingAddr,
				auctionFee,
			);

			await unlock(accts[1], 100000000);

			await truffleAssert.reverts(
				auc.bid(minBid * 10 + 1, { from: accts[1] }),
				"Bid amount too high",
			);
		});

		describe("when bidder unlocked the bid amount", () => {
			beforeEach(async () => {
				maxPeriods = 1;
				auc = await Auction.new(
					dil.address,
					minDILSupply,
					maxPeriods,
					ltnSupplyPerPeriod,
					minBid,
					fundingAddr,
					auctionFee,
				);

				await unlock(accts[1], 1000);

				// place bid
				await auc.bid(1000, { from: accts[1] });
			});

			it("should create a period", async () => {
				expect((await auc.getNumOfPeriods()).toNumber()).to.equal(1);
				const period = await auc.periods(0);
				expect(period.ltnSupply.toNumber()).to.equal(ltnSupplyPerPeriod);
				expect(period.totalBids.toNumber()).to.equal(1000);
			});

			it("should add a claim", async () => {
				expect((await auc.getNumOfClaims({ from: accts[1] })).toNumber()).to.equal(1);
				const claim = await auc.claims(accts[1], 0);
				expect(claim.period.toNumber()).to.equal(0);
				expect(claim.bid.toNumber()).to.equal(1000);
			});

			it("should destroy bid amount from sender DIL balance", async () => {
				expect((await dil.allowance(accts[1], auc.address)).toNumber()).to.equal(0);
				expect((await dil.balanceOf(accts[1])).toNumber()).to.equal(0);
			});
		});

		describe("when sender bids thrice. 2 in same period and 1 in another period", () => {
			beforeEach(async () => {
				maxPeriods = 2;
				auc = await Auction.new(
					dil.address,
					minDILSupply,
					maxPeriods,
					ltnSupplyPerPeriod,
					minBid,
					fundingAddr,
					auctionFee,
				);

				await unlock(accts[1], 1500);

				// place bids
				await auc.bid(500, { from: accts[1] });
				await auc.bid(500, { from: accts[1] });
				await utils.advanceTime(86500);
				await auc.bid(500, { from: accts[1] });
			});

			it("should create a period", async () => {
				expect((await auc.getNumOfPeriods()).toNumber()).to.equal(2);
				let period = await auc.periods(0);
				expect(period.ltnSupply.toNumber()).to.equal(ltnSupplyPerPeriod);
				expect(period.totalBids.toNumber()).to.equal(1000);

				period = await auc.periods(1);
				expect(period.ltnSupply.toNumber()).to.equal(ltnSupplyPerPeriod);
				expect(period.totalBids.toNumber()).to.equal(500);
			});

			it("should add three claims of 500 each for the sender", async () => {
				expect((await auc.getNumOfClaims({ from: accts[1] })).toNumber()).to.equal(3);
				let claim = await auc.claims(accts[1], 0);
				expect(claim.period.toNumber()).to.equal(0);
				expect(claim.bid.toNumber()).to.equal(500);

				claim = await auc.claims(accts[1], 1);
				expect(claim.period.toNumber()).to.equal(0);
				expect(claim.bid.toNumber()).to.equal(500);

				claim = await auc.claims(accts[1], 2);
				expect(claim.period.toNumber()).to.equal(1);
				expect(claim.bid.toNumber()).to.equal(500);
			});
		});

		describe("when an account has more than 5 unprocessed claims", () => {
			it("should revert with 'Too many unprocessed claims'", async () => {
				auc = await Auction.new(
					dil.address,
					minDILSupply,
					maxPeriods,
					ltnSupplyPerPeriod,
					minBid,
					fundingAddr,
					auctionFee,
				);
				await unlock(accts[1], 600);
				await bid(accts[1], 100);
				await bid(accts[1], 100);
				await bid(accts[1], 100);
				await bid(accts[1], 100);
				await bid(accts[1], 100);
				expect((await auc.getNumOfClaims({ from: accts[1] })).toNumber()).to.equal(5);
				await truffleAssert.reverts(bid(accts[1], 100), "Too many unprocessed claims");
			});
		});

		describe("when there are more than 7 periods", () => {
			beforeEach(async () => {
				maxPeriods = 10;
				auctionFee = 1000;
				auc = await Auction.new(
					dil.address,
					minDILSupply,
					maxPeriods,
					ltnSupplyPerPeriod,
					minBid,
					fundingAddr,
					auctionFee,
				);
				await unlock(accts[1], 100000000);
				await bid(accts[1], 100);
				await utils.advanceTime(86500);
				await bid(accts[1], 100);
				await utils.advanceTime(86500);
				await bid(accts[1], 100);
				await utils.advanceTime(86500);
				await bid(accts[1], 100);
				await utils.advanceTime(86500);
				await bid(accts[1], 100);
				await auc.claim({ from: accts[1] });
				await utils.advanceTime(86500);
				await bid(accts[1], 100);
				await utils.advanceTime(86500);
				await bid(accts[1], 100);
				await utils.advanceTime(86500);
			});

			it("should revert with 'Bid amount too small' if minBid is < (50 * minBid)", async () => {
				await truffleAssert.reverts(
					bid(accts[1], minBid * 50 - 1),
					"Bid amount too small",
				);
			});

			it("should revert if deposit fee sent is insufficient", async () => {
				await truffleAssert.reverts(
					bid(accts[1], minBid * 50, 100),
					"Auction fee too low",
				);
			});

			it("should accept bid if minBid is >= (50 * minBid) and auction fee is sufficient", async () => {
				await utils.advanceTime(86500);
				let bidAmt = minBid * 50;
				let aucFee = auctionFee * bidAmt;
				await bid(accts[1], minBid * 50, aucFee);
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
					auc = await Auction.new(
						dil.address,
						minDILSupply,
						maxPeriods,
						ltnSupplyPerPeriod,
						minBid,
						fundingAddr,
						auctionFee,
					);
					await unlock(accts[1], 500);
					await bid(accts[1], 500);
					await utils.advanceTime(86500);
					await auc.claim({ from: accts[1] });
					expect((await auc.balanceOf(accts[1])).toNumber()).to.equal(1000);

					// should have zero claims
					expect((await auc.getNumOfClaims({ from: accts[1] })).toNumber()).to.equal(0);
				});

				it("should not allocate period supply when period has not ended", async () => {
					auc = await Auction.new(
						dil.address,
						minDILSupply,
						maxPeriods,
						ltnSupplyPerPeriod,
						minBid,
						fundingAddr,
						auctionFee,
					);
					await unlock(accts[1], 500);
					await bid(accts[1], 500);
					await auc.claim({ from: accts[1] });
					expect((await auc.balanceOf(accts[1])).toNumber()).to.equal(0);

					// should have one claim
					expect((await auc.getNumOfClaims({ from: accts[1] })).toNumber()).to.equal(1);
				});
			});

			describe("when there are two bids from same account", () => {
				it("should allocate 100% of period supply to the only bidder", async () => {
					auc = await Auction.new(
						dil.address,
						minDILSupply,
						maxPeriods,
						ltnSupplyPerPeriod,
						minBid,
						fundingAddr,
						auctionFee,
					);
					await unlock(accts[1], 1200);
					await bid(accts[1], 500);
					await bid(accts[1], 700);
					await utils.advanceTime(86500);
					await auc.claim({ from: accts[1] });
					expect((await auc.balanceOf(accts[1])).toNumber()).to.equal(999);

					// should have zero claims
					expect((await auc.getNumOfClaims({ from: accts[1] })).toNumber()).to.equal(0);
				});
			});

			describe("when there are three bids from different accts", () => {
				it("should respectively allocate 357,500,142 of period supply account 1,2,3", async () => {
					auc = await Auction.new(
						dil.address,
						minDILSupply,
						maxPeriods,
						ltnSupplyPerPeriod,
						minBid,
						fundingAddr,
						auctionFee,
					);
					await unlock(accts[1], 500);
					await bid(accts[1], 500);
					await unlock(accts[2], 700);
					await bid(accts[2], 700);
					await unlock(accts[3], 200);
					await bid(accts[3], 200);
					await utils.advanceTime(86500);
					await auc.claim({ from: accts[1] });
					await auc.claim({ from: accts[2] });
					await auc.claim({ from: accts[3] });
					expect((await auc.balanceOf(accts[1])).toNumber()).to.equal(357);
					expect((await auc.balanceOf(accts[2])).toNumber()).to.equal(500);
					expect((await auc.balanceOf(accts[3])).toNumber()).to.equal(142);

					// should have zero claims for all claimed accts
					expect((await auc.getNumOfClaims({ from: accts[1] })).toNumber()).to.equal(0);
					expect((await auc.getNumOfClaims({ from: accts[2] })).toNumber()).to.equal(0);
					expect((await auc.getNumOfClaims({ from: accts[3] })).toNumber()).to.equal(0);
				});
			});

			describe("when an account claims are deleted, other account claims should not be affected", () => {
				it("should not affect other account claims", async () => {
					auc = await Auction.new(
						dil.address,
						minDILSupply,
						maxPeriods,
						ltnSupplyPerPeriod,
						minBid,
						fundingAddr,
						auctionFee,
					);
					await unlock(accts[1], 500);
					await bid(accts[1], 500);
					await unlock(accts[2], 700);
					await bid(accts[2], 700);
					await unlock(accts[3], 200);
					await bid(accts[3], 200);
					await utils.advanceTime(86500);
					await auc.claim({ from: accts[1] });
					expect((await auc.balanceOf(accts[1])).toNumber()).to.equal(357);
					expect((await auc.balanceOf(accts[2])).toNumber()).to.equal(0);
					expect((await auc.balanceOf(accts[3])).toNumber()).to.equal(0);

					// should have zero claims for account 1
					expect((await auc.getNumOfClaims({ from: accts[1] })).toNumber()).to.equal(0);

					// should have one claim for account 2
					expect((await auc.getNumOfClaims({ from: accts[2] })).toNumber()).to.equal(1);

					// should have one claim for account 3
					expect((await auc.getNumOfClaims({ from: accts[3] })).toNumber()).to.equal(1);
				});
			});
		});

		describe("within two or more periods and when only one bid is received per period", () => {
			it("should allocate 100% of both periods supply to the only bidder", async () => {
				auc = await Auction.new(
					dil.address,
					minDILSupply,
					maxPeriods,
					ltnSupplyPerPeriod,
					minBid,
					fundingAddr,
					auctionFee,
				);
				await unlock(accts[1], 1000);
				await bid(accts[1], 500);
				utils.advanceTime(86500);
				await bid(accts[1], 500);
				await utils.advanceTime(86500);
				expect((await auc.getNumOfPeriods()).toNumber()).to.equal(2);
				await auc.claim({ from: accts[1] });
				expect((await auc.balanceOf(accts[1])).toNumber()).to.equal(2000);

				expect((await auc.getNumOfClaims({ from: accts[1] })).toNumber()).to.equal(0);
			});
		});
	});

	describe(".getNumOfClaimsOfAddr", () => {
		it("should return expected number of claims", async () => {
			auc = await Auction.new(
				dil.address,
				minDILSupply,
				maxPeriods,
				ltnSupplyPerPeriod,
				minBid,
				fundingAddr,
				auctionFee,
			);
			await unlock(accts[1], 1000);
			await bid(accts[1], 500);
			await bid(accts[1], 500);
			expect((await auc.getNumOfClaimsOfAddr(accts[1])).toNumber()).to.equal(2);
		});
	});

	describe(".setMaxPeriods", () => {
		it("should update maxPeriods", async () => {
			let mp = await auc.maxPeriods();
			expect(mp.toNumber()).to.equal(maxPeriods);
			await auc.setMaxPeriods(10);
			mp = await auc.maxPeriods();
			expect(mp.toNumber()).to.equal(10);
		});
	});

	describe(".withdraw", () => {
		it("should revert with 'Not authorized' if sender is not the funding address", async () => {
			expect(await auc.fundingAddress()).to.equal(accts[5]);
			await truffleAssert.reverts(
				auc.withdraw(1000, { from: accts[0] }),
				"Not authorized",
			);
		});

		it("should revert with 'Transfer failed' if contract balance is less than amount", async () => {
			expect(await auc.fundingAddress()).to.equal(accts[5]);
			await truffleAssert.reverts(
				auc.withdraw(1000, { from: accts[5] }),
				"Transfer failed",
			);
		});

		it("should successfully transfer amount if contract balance is sufficient", async () => {
			// send eth to contract
			await auc.sendTransaction({ from: accts[0], value: web3.utils.toWei("10") });
			expect(await web3.eth.getBalance(auc.address)).to.equal(web3.utils.toWei("10"));

			// get eth balance of funding address
			let fundingAddrBal = await web3.eth.getBalance(accts[5]);

			// withdraw into funding address
			await auc.withdraw(web3.utils.toWei("5"), { from: accts[5] });

			// check that contract balance reduced
			expect(await web3.eth.getBalance(auc.address)).to.equal(web3.utils.toWei("5"));

			// check that funding address increase
			let curFundingAddrBal = await web3.eth.getBalance(accts[5]);
			expect(new web3.utils.BN(fundingAddrBal).lt(new web3.utils.BN(curFundingAddrBal)))
				.to.be.true;
		});
	});

	describe(".setFee", () => {
		it("should revert if sender is not owner", async () => {
			await truffleAssert.reverts(
				auc.setFee(10000, { from: accts[2] }),
				"Sender is not owner",
			);
		});

		it("should update fee", async () => {
			expect((await auc.fee()).toNumber()).to.equal(auctionFee);
			await auc.setFee(10000, { from: accts[0] });
			expect((await auc.fee()).toNumber()).to.equal(10000);
		});
	});

	describe(".setFundingAddress", async function () {
		it("should revert if sender is not owner", async () => {
			await truffleAssert.reverts(
				auc.setFundingAddress(accts[6], { from: accts[2] }),
				"Sender is not owner",
			);
		});

		it("should set new address if sender is owner", async () => {
			expect(await auc.fundingAddress()).to.equal(accts[5]);
			await auc.setFundingAddress(accts[6], { from: accts[0] });
			expect(await auc.fundingAddress()).to.equal(accts[6]);
		});
	});

	describe(".transferUnallocated", () => {
		it("should revert if auction has not ended", async () => {
			await truffleAssert.reverts(
				auc.transferUnallocated(accts[3], 1000),
				"Auction must end",
			);

			maxPeriods = 2;
			auc = await Auction.new(
				dil.address,
				minDILSupply,
				maxPeriods,
				ltnSupplyPerPeriod,
				minBid,
				fundingAddr,
				auctionFee,
			);
			await unlock(accts[1], 100);
			await bid(accts[1], 100);
			utils.advanceTime(86500);
			await truffleAssert.reverts(
				auc.transferUnallocated(accts[3], 1000),
				"Auction must end",
			);
		});

		it("should revert if transfer amount surpasses unallocated supply", async () => {
			maxPeriods = 1;
			auc = await Auction.new(
				dil.address,
				minDILSupply,
				maxPeriods,
				ltnSupplyPerPeriod,
				minBid,
				fundingAddr,
				auctionFee,
			);

			await unlock(accts[1], 100);
			await bid(accts[1], 100);
			utils.advanceTime(86500);

			await truffleAssert.reverts(
				auc.transferUnallocated(accts[3], "200000000000000000000000000"),
				"Insufficient remaining supply",
			);
		});

		it("should transfer all unallocated supply", async () => {
			maxPeriods = 1;
			auc = await Auction.new(
				dil.address,
				minDILSupply,
				maxPeriods,
				ltnSupplyPerPeriod,
				minBid,
				fundingAddr,
				auctionFee,
			);

			await unlock(accts[1], 100);
			await bid(accts[1], 100);
			utils.advanceTime(86500);

			await auc.transferUnallocated(accts[3], 1000);
			let bal = await auc.balanceOf(accts[3]);
			expect(bal.eq(new web3.utils.BN(1000))).to.be.true;
		});
	});
});
