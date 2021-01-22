const Main = artifacts.require("Main");
const truffleAssert = require("truffle-assertions");

contract("Main", (accounts) => {
	let ins;
	beforeEach(async () => {
		ins = await Main.new({ from: accounts[0] });
	});

	describe(".getDILBalance", async function () {
		it("should return zero (0) if no DIL has been minted for an address", async () => {
			const res = await ins.getDILBalance.call(accounts[1]);
			expect(res.toNumber()).to.equal(0);
		});
	});

	describe(".getNextMintLimit", async function () {
		it("should return zero (0) if no DIL has been minted for an address", async () => {
			const res = await ins.getNextMintLimit.call(accounts[1]);
			expect(res.toNumber()).to.equal(0);
		});
	});

	describe(".mint", async () => {
		it("should revert when sender is not owner", async () => {
			await truffleAssert.reverts(
				ins.mint.call(accounts[1], 100, { from: accounts[1] }),
				"Sender is not owner",
			);
		});

		describe("when minting for the first time", async () => {
			beforeEach(async () => {
				const res = await ins.mint(accounts[1], 1000, { from: accounts[0] });
				expect(res.logs).to.have.lengthOf(1);
				expect(res.logs[0].event).to.equal("DILMinted");
				expect(res.logs[0].args["recipient"]).to.equal(accounts[1]);
				expect(res.logs[0].args["amt"].toNumber()).to.equal(1000);
			});

			it("should mint and allocate the provided balance", async () => {
				const curBal = await ins.getDILBalance.call(accounts[1]);
				expect(curBal.toNumber()).to.equal(1000);
			});

			it("should set the next limit to 1x mint limit", async () => {
				const limit = await ins.limit.call();
				const nextLimit = await ins.getNextMintLimit.call(accounts[1]);
				expect(nextLimit.toNumber()).to.equal(limit.toNumber());
			});
		});

		describe("when minting for the n+1 times with mint amount less than the recipient next limit", async () => {
			beforeEach(async () => {
				await ins.mint(accounts[1], 1000, { from: accounts[0] });
				await ins.mint(accounts[1], 1000, { from: accounts[0] });
			});

			it("should mint and allocate the provided balance", async () => {
				const curBal = await ins.getDILBalance.call(accounts[1]);
				expect(curBal.toNumber()).to.equal(2000);
			});

			it("should not reset the next limit", async () => {
				const limit = await ins.limit.call();
				const nextLimit = await ins.getNextMintLimit.call(accounts[1]);
				expect(nextLimit.toNumber()).to.equal(limit.toNumber());
			});
		});

		describe("when minting for the first time with a mint amount greater than the default limit", async () => {
			it("should successfully mint and allocate to recipient", async () => {
				const limit = await ins.limit.call();
				const res = await ins.mint(accounts[1], limit.toNumber() + 1, {
					from: accounts[0],
				});
				expect(res.logs).to.have.lengthOf(1);
				expect(res.logs[0].event).to.equal("DILMinted");
				expect(res.logs[0].args["recipient"]).to.equal(accounts[1]);
				expect(res.logs[0].args["amt"].toNumber()).to.equal(limit.toNumber() + 1);
			});
		});

		describe("when mint amount is greater than the recipient next limit and no mint fee is sent", async () => {
			beforeEach(async () => {
				await ins.mint(accounts[1], 1000, { from: accounts[0] });
			});

			it("should revert due to insufficient mint fee", async () => {
				const limit = await ins.limit.call();
				await truffleAssert.reverts(
					ins.mint(accounts[1], 1 + limit.toNumber(), { from: accounts[0] }),
					"Insufficient mint fee",
				);
			});
		});

		describe("when mint amount is greater than the recipient next limit and insufficient mint fee is sent", async () => {
			beforeEach(async () => {
				await ins.mint(accounts[1], 1000, { from: accounts[0] });
			});

			it("should revert due to insufficient mint fee", async () => {
				const limit = await ins.limit.call();
				await truffleAssert.reverts(
					ins.mint(accounts[1], 1 + limit.toNumber(), {
						from: accounts[0],
						value: new web3.utils.BN(web3.utils.toWei("0.001", "ether")),
					}),
					"Insufficient mint fee",
				);
			});
		});

		describe("when mint amount is greater than the recipient next limit and sufficient mint fee is sent", async () => {
			beforeEach(async () => {
				await ins.mint(accounts[1], 1000, { from: accounts[0] });
			});

			it("should revert due to insufficient mint fee", async () => {
				const limit = await ins.limit.call();
				const mintFee = await ins.mintFee.call();
				const res = await ins.mint(accounts[1], 1 + limit.toNumber(), {
					from: accounts[0],
					value: mintFee,
				});
				expect(res.logs).to.have.lengthOf(1);
				expect(res.logs[0].event).to.equal("DILMinted");
				expect(res.logs[0].args["recipient"]).to.equal(accounts[1]);
				expect(res.logs[0].args["amt"].toNumber()).to.equal(limit.toNumber() + 1);

				const curBal = await ins.getDILBalance.call(accounts[1]);
				expect(curBal.toNumber()).to.equal(1000 + 1 + limit.toNumber());
			});
		});
	});
});
