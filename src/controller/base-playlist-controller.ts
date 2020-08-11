import Hls from '../hls';
import { NetworkComponentAPI } from '../types/component-api';
import { HlsUrlParameters } from '../types/level';
import type LevelDetails from '../loader/level-details';
import { logger } from '../utils/logger';
import { computeReloadInterval } from './level-helper';
import { LoaderStats } from '../types/loader';

export default class BasePlaylistController implements NetworkComponentAPI {
  protected hls: Hls;
  protected timer: number = -1;
  protected canLoad: boolean = false;

  constructor (hls: Hls) {
    this.hls = hls;
  }

  public destroy (): void {
    this.clearTimer();
  }

  protected clearTimer (): void {
    clearTimeout(this.timer);
    this.timer = -1;
  }

  public startLoad (): void {
    this.canLoad = true;
    this.loadPlaylist();
  }

  public stopLoad (): void {
    this.canLoad = false;
    this.clearTimer();
  }

  protected loadPlaylist (hlsUrlParameters?: HlsUrlParameters): void {}

  protected playlistLoaded (index: number, details: LevelDetails, previousDetails: LevelDetails | undefined, stats: LoaderStats) {
    // if current playlist is a live playlist, arm a timer to reload it
    if (details.live) {
      details.reloaded(previousDetails);
      if (previousDetails) {
        logger.log(`[${this.constructor?.name}] live playlist ${index} ${details.advanced ? 'REFRESHED' : 'MISSED'}`);
      }
      if (!this.canLoad) {
        return;
      }
      // TODO: Do not use LL-HLS delivery directives if playlist "endSN" is stale
      if (details.canBlockReload && details.endSN && details.advanced) {
        // Load level with LL-HLS delivery directives
        // TODO: LL-HLS Specify latest partial segment
        // TODO: LL-HLS enable skip parameter for delta playlists independent of canBlockReload
        this.loadPlaylist(new HlsUrlParameters(details.endSN + 1, 0, false));
        return;
      }
      const reloadInterval = computeReloadInterval(details, stats);
      logger.log(`[${this.constructor?.name}] reload live playlist ${index} in ${Math.round(reloadInterval)} ms`);
      this.timer = self.setTimeout(() => this.loadPlaylist(), reloadInterval);
    } else {
      this.clearTimer();
    }
  }
}
