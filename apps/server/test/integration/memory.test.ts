import { MemoryRepository } from '../../src/db/memory/index.js';
import { runCommandSuite } from '../commands.suite.js';
import { runRepoContract } from '../repo.contract.js';

const make = async () => new MemoryRepository();
runRepoContract('memory', make);
runCommandSuite('memory', make);
