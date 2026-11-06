import 'server-only';
import {requestReader} from './reader-queue';
import type {HomeData} from './home-data';
export const getHomeData=()=>requestReader<HomeData>({kind:'home'});
