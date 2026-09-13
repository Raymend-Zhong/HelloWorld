import taskPoolPersistenceTest from './TaskPoolPersistence.test';
import taskPoolFlowTest from './TaskPoolFlow.test';
import arkDataContractTest from './ArkDataContract.test';
import entryFlowTest from './EntryFlow.test';

export default function testsuite(): void {
  taskPoolFlowTest();
  entryFlowTest();
  arkDataContractTest();
  taskPoolPersistenceTest();
}
