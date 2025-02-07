import {
    EventEmitter
} from "events";
import web3Js from 'web3';
import { ethers } from 'ethers';
import ERC20TokenContractAbi from "../abis/erc20TokenAbi.json";
import web3Config from "../config/web3Config";

const pad32Bytes = (data) => {
    var s = String(data);
    while (s.length < (64 || 2)) { s = "0" + s; }
    return s;
}

class ERC20TokenContract extends EventEmitter {
    
    constructor(web3, contractAddress, spenderAddress = null) {
        super();
        this.web3 = web3;
        this.contractAddress = contractAddress;
        this.spenderAddress = spenderAddress;

        this.contractInstance = new ethers.Contract(
            this.contractAddress,
            ERC20TokenContractAbi,
            this.web3.getSigner(0)
        );
    }

    async isContractExist(){
        try {
            const response = await this.web3.getCode(this.contractAddress);
            if(response === '0x'){
                return false;
            } else {
                return true;
            }
        } catch(error){
            return false;
        }
    }

    async getTokenInfo(successCb, errorCb) {
        try {
            
            const isContractExist = await this.isContractExist();

            if(isContractExist){
                const name = await this.contractInstance.name();
                const symbol = await this.contractInstance.symbol();
                const decimals = await this.contractInstance.decimals();
                const totalSupply = await this.contractInstance.totalSupply();
                successCb({name: name, symbol: symbol, decimals: decimals, totalSupply: ethers.utils.formatUnits(totalSupply, decimals)});
            } else {
                errorCb({
                    error: 'Token contract does not exist.'
                });
            }
        } catch(error){
            errorCb({
                error: error.message
            });
        }
    }

    allowance = async(successCb, errorCb) => {
        try {
            const isContractExist = await this.isContractExist();
            if(isContractExist){
                console.log({ownerAddress: web3Config.getAddress(), tokenAddress: this.contractAddress, bridgeAddress: this.spenderAddress});
                const allowanceLimit = await this.contractInstance.allowance(web3Config.getAddress(), this.spenderAddress);
                successCb((allowanceLimit).toString());
            } else {
                errorCb({
                    error: 'Token contract does not exist.'
                });
            }
        } catch(error){
            errorCb({
                error: error.message
            });
        }
    }

    approve = async(amount, txCb, receiptCb) => {
        try {
            const isContractExist = await this.isContractExist();
            if(isContractExist){

                const args = {
                    spender: this.spenderAddress,
                    amount: amount
                };
    
                console.log(args);
    
                let payload = ethers.utils.defaultAbiCoder.encode([
                    "address",
                    "uint256"
                ], [
                    this.spenderAddress,
                    (amount).toString(),
                ]);
    
                payload = payload.slice(2);
                payload = `0x095ea7b3${pad32Bytes(payload)}`;

                await this.sendTransaction(payload, 0, this.contractAddress, txCb, receiptCb);

            } else {
                receiptCb({
                    error: 'Token contract does not exist.'
                });
            }
        } catch(error){
            receiptCb({
                error: error.message
            });
        }
    }

    sendTransaction = async(payload, value, to, txCb, receiptCb) => {
        try {
            const gasPrice = await this.web3.getGasPrice();

            console.log((gasPrice).toString());
            
            const gasLimit = await this.web3.getSigner(0).estimateGas({
                // Wrapped ETH address
                to: to,              
                data: payload,
                value: web3Js.utils.toHex(value)
            });

            console.log({
                gasPrice: (gasPrice).toString(),
                gasLimit: (gasLimit).toString()
            });

            const tx = {
                to: to,
                data: payload,
                gasPrice: web3Js.utils.toHex(gasPrice),
                gasLimit: web3Js.utils.toHex(gasLimit),
                value: web3Js.utils.toHex(value)
            };

            this.web3.getSigner(0).sendTransaction(tx).then(result => {
                txCb(result.hash)
                result.wait().then(async(receipt) => {
                    receiptCb(receipt);
                }).catch(error => {
                    console.error(error);
                    receiptCb(error);
                });
            }).catch(error => {
                console.error(error);
                receiptCb(error);
            });

        } catch(error){
            console.error(error);
            receiptCb(error);
        }
    }    

}


export default ERC20TokenContract;