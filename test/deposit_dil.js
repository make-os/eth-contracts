const Main = artifacts.require("Main");
const Latinum = artifacts.require("Latinum");
const Auction = artifacts.require("Auction");
const Dilithium = artifacts.require("Dilithium");
const ELL = artifacts.require("../contracts/libraries/ell/EIP20.sol");
const truffleAssert = require("truffle-assertions");

contract("DILDeposit", (accounts) => {
	let main, ell, dil, auc;
	let ltnSupplyPerPeriod,
		minDILSupply,
		maxPeriods,
		minBid,
		maxSwappableELL,
		fundingAddr,
		dilDepositFee,
		decayHaltFee,
		decayDur;

	beforeEach(async () => {
		ell = await ELL.new("150000000000", "Ellcrys Network Token", 18, "ELL", {
			from: accounts[3],
		});

		decayHaltFee = web3.utils.toWei("2");
		decayDur = 86400 * 60;
		dil = await Dilithium.new(decayHaltFee, decayDur, { from: accounts[0] });

		ltnSupplyPerPeriod = 100;
		maxPeriods = 1;
		minBid = 100;
		minDILSupply = 100;
		auc = await Auction.new(
			dil.address,
			minDILSupply,
			maxPeriods,
			ltnSupplyPerPeriod,
			minBid,
			{ from: accounts[0] },
		);

		await dil.setLTNAddress(auc.address);

		maxSwappableELL = 10000;
		fundingAddr = accounts[5];
		dilDepositFee = web3.utils.toWei("0.00001", "ether");
		let uniswapRouter = "0x0000000000000000000000000000000000000000";
		main = await Main.new(
			dilDepositFee,
			maxSwappableELL,
			ell.address,
			dil.address,
			auc.address,
			fundingAddr,
			uniswapRouter,
			{ from: accounts[0] },
		);
		await auc.setOwnerOnce(main.address, { from: accounts[0] });
		await dil.setOwnerOnce(main.address, { from: accounts[0] });
	});

	describe(".setDepositFee", async function () {
		it("should set deposit fee successfully", async () => {
			let fee = await main.depositFee.call();
			expect(fee.toString()).to.equal(dilDepositFee);
			await main.setDepositFee(1234);
			fee = await main.depositFee.call();
			expect(fee.toNumber()).to.equal(1234);
		});
	});

	describe(".totalDepositedDIL", async function () {
		it("should return zero (0) if no DIL has been minted for an address", async () => {
			const res = await main.totalDepositedDIL.call(accounts[1]);
			expect(res.toNumber()).to.equal(0);
		});
	});

	describe(".mintDIL", async () => {
		it("should revert when sender is not owner", async () => {
			await truffleAssert.reverts(
				main.mintDIL(accounts[1], 100, { from: accounts[1] }),
				"Sender is not owner",
			);
		});

		describe("when minting for the first time", async () => {
			beforeEach(async () => {
				const res = await main.mintDIL(accounts[1], 1000, { from: accounts[0] });
				expect(res.logs).to.have.lengthOf(1);
				expect(res.logs[0].event).to.equal("DILMinted");
				expect(res.logs[0].args["recipient"]).to.equal(accounts[1]);
				expect(res.logs[0].args["amt"].toNumber()).to.equal(1000);
			});

			it("should mint and allocate the provided balance", async () => {
				const curBal = await main.totalDepositedDIL.call(accounts[1]);
				expect(curBal.toNumber()).to.equal(1000);
				expect((await dil.balanceOf(accounts[1])).toNumber()).to.equal(1000);
			});
		});

		describe("when minting for the n>1 times with the correct deposit fee", async () => {
			beforeEach(async () => {
				await main.mintDIL(accounts[1], 1000, { from: accounts[0] });
				const depFee = new web3.utils.BN(1000).mul(new web3.utils.BN(dilDepositFee));
				await main.mintDIL(accounts[1], 1000, { from: accounts[0], value: depFee });
			});

			it("should mint and allocate the provided balance", async () => {
				const curBal = await main.totalDepositedDIL.call(accounts[1]);
				expect(curBal.toNumber()).to.equal(2000);
				expect((await dil.balanceOf(accounts[1])).toNumber()).to.equal(2000);
			});
		});

		describe("when minting for the n>1 times with less than the correct deposit fee", async () => {
			beforeEach(async () => {
				await main.mintDIL(accounts[1], 1000, { from: accounts[0] });
			});

			it("should revert with 'Insufficient deposit fee'", async () => {
				const depFee = new web3.utils.BN(1000).mul(new web3.utils.BN(dilDepositFee));
				await truffleAssert.reverts(
					main.mintDIL(accounts[1], 1000, {
						from: accounts[0],
						value: depFee.sub(new web3.utils.BN("1")),
					}),
					"Insufficient deposit fee",
				);

				const curBal = await main.totalDepositedDIL.call(accounts[1]);
				expect(curBal.toNumber()).to.equal(1000);
				expect((await dil.balanceOf(accounts[1])).toNumber()).to.equal(1000);
			});
		});
	});
});
