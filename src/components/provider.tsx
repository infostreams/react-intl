/*
 * Copyright 2015, Yahoo Inc.
 * Copyrights licensed under the New BSD License.
 * See the accompanying LICENSE file for terms.
 */

import * as React from 'react';
import {Provider} from './injectIntl';
import {
  createError,
  DEFAULT_INTL_CONFIG,
  createFormatters,
  invariantIntlContext,
  createIntlCache,
} from '../utils';
import {IntlConfig, IntlShape, Omit, IntlCache} from '../types';
import areIntlLocalesSupported from 'intl-locales-supported';
import {formatNumber, formatNumberToParts} from '../formatters/number';
import {formatRelativeTime} from '../formatters/relativeTime';
import {
  formatDate,
  formatTime,
  formatDateToParts,
  formatTimeToParts,
} from '../formatters/dateTime';
import {formatPlural} from '../formatters/plural';
import {formatMessage, formatHTMLMessage} from '../formatters/message';
import * as shallowEquals_ from 'shallow-equal/objects';
const shallowEquals: typeof shallowEquals_ =
  (shallowEquals_ as any).default || shallowEquals_;

interface State {
  /**
   * Explicit intl cache to prevent memory leaks
   */
  cache: IntlCache;
  /**
   * Intl object we created
   */
  intl?: IntlShape;
  /**
   * list of memoized config we care about.
   * This is important since creating intl is
   * very expensive
   */
  prevConfig: OptionalIntlConfig;
}

export type OptionalIntlConfig = Omit<
  IntlConfig,
  keyof typeof DEFAULT_INTL_CONFIG
> &
  Partial<typeof DEFAULT_INTL_CONFIG>;

function setTimeZoneInOptions(
  opts: Record<string, Intl.DateTimeFormatOptions>,
  timeZone: string
) {
  return Object.keys(opts).reduce(
    (all: Record<string, Intl.DateTimeFormatOptions>, k) => {
      all[k] = {
        timeZone,
        ...opts[k],
      };
      return all;
    },
    {}
  );
}

function processIntlConfig<P extends OptionalIntlConfig = OptionalIntlConfig>(
  config: P
): OptionalIntlConfig {
  let {formats, defaultFormats, timeZone} = config;
  if (timeZone) {
    if (formats) {
      const {date: dateFormats, time: timeFormats} = formats;
      if (dateFormats) {
        formats = {
          ...formats,
          date: setTimeZoneInOptions(dateFormats, timeZone),
        };
      }
      if (timeFormats) {
        formats = {
          ...formats,
          time: setTimeZoneInOptions(timeFormats, timeZone),
        };
      }
    }
    if (defaultFormats) {
      const {date: dateFormats, time: timeFormats} = defaultFormats;
      if (dateFormats) {
        defaultFormats = {
          ...defaultFormats,
          date: setTimeZoneInOptions(dateFormats, timeZone),
        };
      }
      if (timeFormats) {
        defaultFormats = {
          ...defaultFormats,
          time: setTimeZoneInOptions(timeFormats, timeZone),
        };
      }
    }
  }
  return {
    locale: config.locale,
    timeZone,
    formats,
    textComponent: config.textComponent,
    messages: config.messages,
    defaultLocale: config.defaultLocale,
    defaultFormats,
    onError: config.onError,
  };
}

export default class IntlProvider extends React.PureComponent<
  OptionalIntlConfig,
  State
> {
  static displayName: string = 'IntlProvider';
  static defaultProps = DEFAULT_INTL_CONFIG;
  private cache: IntlCache = createIntlCache();
  state: State = {
    cache: this.cache,
    intl: createIntl(processIntlConfig(this.props), this.cache),
    prevConfig: processIntlConfig(this.props),
  };

  static getDerivedStateFromProps(
    props: OptionalIntlConfig,
    {prevConfig, cache}: State
  ): Partial<State> | null {
    const config = processIntlConfig(props);
    if (!shallowEquals(prevConfig, config)) {
      return {
        intl: createIntl(config, cache),
        prevConfig: config,
      };
    }
    return null;
  }

  render() {
    invariantIntlContext(this.state.intl);
    return <Provider value={this.state.intl!}>{this.props.children}</Provider>;
  }
}

/**
 * Create intl object
 * @param config intl config
 * @param cache cache for formatter instances to prevent memory leak
 */
export function createIntl(
  config: OptionalIntlConfig,
  cache?: IntlCache
): IntlShape {
  const formatters = createFormatters(cache);
  const resolvedConfig = {...DEFAULT_INTL_CONFIG, ...config};
  if (
    !resolvedConfig.locale ||
    !areIntlLocalesSupported(resolvedConfig.locale)
  ) {
    const {locale, defaultLocale, onError} = resolvedConfig;
    if (typeof onError === 'function') {
      onError(
        createError(
          `Missing locale data for locale: "${locale}". ` +
            `Using default locale: "${defaultLocale}" as fallback.`
        )
      );
    }

    // Since there's no registered locale data for `locale`, this will
    // fallback to the `defaultLocale` to make sure things can render.
    // The `messages` are overridden to the `defaultProps` empty object
    // to maintain referential equality across re-renders. It's assumed
    // each <FormattedMessage> contains a `defaultMessage` prop.
    resolvedConfig.locale = resolvedConfig.defaultLocale || 'en';
  }
  return {
    ...resolvedConfig,
    formatters,
    formatNumber: formatNumber.bind(
      null,
      resolvedConfig,
      formatters.getNumberFormat
    ),
    formatNumberToParts: formatNumberToParts.bind(
      null,
      resolvedConfig,
      formatters.getNumberFormat
    ),
    formatRelativeTime: formatRelativeTime.bind(
      null,
      resolvedConfig,
      formatters.getRelativeTimeFormat
    ),
    formatDate: formatDate.bind(
      null,
      resolvedConfig,
      formatters.getDateTimeFormat
    ),
    formatDateToParts: formatDateToParts.bind(
      null,
      resolvedConfig,
      formatters.getDateTimeFormat
    ),
    formatTime: formatTime.bind(
      null,
      resolvedConfig,
      formatters.getDateTimeFormat
    ),
    formatTimeToParts: formatTimeToParts.bind(
      null,
      resolvedConfig,
      formatters.getDateTimeFormat
    ),
    formatPlural: formatPlural.bind(
      null,
      resolvedConfig,
      formatters.getPluralRules
    ),
    formatMessage: formatMessage.bind(null, resolvedConfig, formatters),
    formatHTMLMessage: formatHTMLMessage.bind(null, resolvedConfig, formatters),
  };
}
