import { isEqual } from 'lodash';

import createConnector from '../core/createConnector';
import {
  getCurrentRefinementValue,
  refineValue,
  getResults,
} from '../core/indexUtils';
import { addAbsolutePositions, addQueryID } from '../core/utils';

function getId() {
  return 'page';
}

function getCurrentRefinement(props, searchState, context) {
  const id = getId();
  const page = 1;
  return getCurrentRefinementValue(
    props,
    searchState,
    context,
    id,
    page,
    currentRefinement => {
      if (typeof currentRefinement === 'string') {
        currentRefinement = parseInt(currentRefinement, 10);
      }
      return currentRefinement;
    }
  );
}

/**
 * InfiniteHits connector provides the logic to create connected
 * components that will render an continuous list of results retrieved from
 * Algolia. This connector provides a function to load more results.
 * @name connectInfiniteHits
 * @kind connector
 * @providedPropType {array.<object>} hits - the records that matched the search state
 * @providedPropType {boolean} hasMore - indicates if there are more pages to load
 * @providedPropType {function} refine - call to load more results
 */
export default createConnector({
  displayName: 'AlgoliaInfiniteHits',

  getProvidedProps(props, searchState, searchResults) {
    const results = getResults(searchResults, this.context);

    this._allResults = this._allResults || [];
    this._prevState = this._prevState || '';

    if (!results) {
      return {
        hits: [],
        hasPrevious: false,
        hasMore: false,
        refine: () => {},
        refinePrevious: () => {},
        refineNext: () => {},
      };
    }

    const {
      page,
      hits,
      hitsPerPage,
      nbPages,
      _state: { page: p, ...currentState } = {},
    } = results;

    const hitsWithPositions = addAbsolutePositions(hits, hitsPerPage, page);
    const hitsWithPositionsAndQueryID = addQueryID(
      hitsWithPositions,
      results.queryID
    );

    if (
      this._firstReceivedPage === undefined ||
      !isEqual(currentState, this._prevState)
    ) {
      this._allResults = [...hitsWithPositionsAndQueryID];
      this._firstReceivedPage = page;
      this._lastReceivedPage = page;
    } else if (this._lastReceivedPage < page) {
      this._allResults = [...this._allResults, ...hitsWithPositionsAndQueryID];
      this._lastReceivedPage = page;
    } else if (this._firstReceivedPage > page) {
      this._allResults = [...hitsWithPositionsAndQueryID, ...this._allResults];
      this._firstReceivedPage = page;
    }

    this._prevState = currentState;

    const hasPrevious = this._firstReceivedPage > 0;
    const lastPageIndex = nbPages - 1;
    const hasMore = page < lastPageIndex;
    const refine = index => {
      const id = getId();
      const nextValue = { [id]: index };
      const resetPage = false;
      this.context.ais.onInternalStateUpdate(
        refineValue(searchState, nextValue, this.context, resetPage)
      );
    };

    return {
      hits: this._allResults,
      hasPrevious,
      hasMore,
      refine: () => refine(this._lastReceivedPage + 2),
      refinePrevious: () => refine(this._firstReceivedPage),
      refineNext: () => refine(this._lastReceivedPage + 2),
    };
  },

  getSearchParameters(searchParameters, props, searchState) {
    return searchParameters.setQueryParameters({
      page: getCurrentRefinement(props, searchState, this.context) - 1,
    });
  },
});
