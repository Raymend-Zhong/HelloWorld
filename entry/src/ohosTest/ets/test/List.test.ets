import arkDataContractTest from './ArkDataContract.test';
import entryFlowTest from './EntryFlow.test';

export default function testsuite(): void {
  entryFlowTest();
  arkDataContractTest();
}
