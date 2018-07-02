import { Button, Col, InputNumber, Layout, Row, Slider } from 'antd';
import { SliderValue } from 'antd/es/slider';
import * as React from 'react';
import { RouteComponentProps } from 'react-router';
import { ChartType } from '../../components/charts/AbstractChart';
import { ProportionChart } from '../../components/charts/ProportionChart';
import { WeightChart } from '../../components/charts/WeightChart';
import { TokenWeightDialog } from '../../components/dialogs/TokenWeightDialog';
import { TokensLegendList } from '../../components/lists/TokensLegendList';
import { TokensProportionsList } from '../../components/lists/TokensProportionsList';
import { TokenWeightList } from '../../components/lists/TokenWeightList';
import PageContent from '../../components/page-content/PageContent';
import PageHeader from '../../components/page-header/PageHeader';
import { TokenLegend } from '../../entities/TokenLegend';
import { lazyInject, Services } from '../../Injections';
import { ProgressListener } from '../../manager/ProgressListener';
import { TokenManager } from '../../manager/TokenManager';
import { Arbitration } from '../../repository/models/Arbitration';
import Pair from '../../repository/models/Pair';
import { Token } from '../../repository/models/Token';
import { TokenPriceHistory } from '../../repository/models/TokenPriceHistory';
import { TokenProportion } from '../../repository/models/TokenProportion';
import { TokenWeight } from '../../repository/models/TokenWeight';
import { DateUtils } from '../../utils/DateUtils';
import './CalculatorPage.less';

interface Props extends RouteComponentProps<{}> {
}

interface State {
  tokenNames: Map<string, boolean>;
  tokensHistory: Map<string, TokenPriceHistory[]>;
  tokensLegend: TokenLegend[];
  tokensDate: number[];
  arbitrationList: Arbitration[];
  arbiterCap: number;
  arbiterProfit: number;
  arbiterTotalTxFee: number;
  amount: number;
  btcUSDT: number;
  btcCount: number;
  cap: number;
  progressPercents: number;
  proportionList: TokenProportion[];
  showCalculationProgress: boolean;
  calculateRangeDateIndex: SliderValue;
  calculateMaxDateIndex: number;
  historyChartRangeDateIndex: SliderValue;
  tokensWeightList: TokenWeight[];
  tokensWeightEditItem: TokenWeight | undefined;
  tokenDialogDateList: string[];
  tokenDialogOpen: boolean;
  tokenLatestWeights: Map<string, number>;
  changeWeightMinDateIndex: number;
  commissionPercents: number;
}

export default class CalculatorPage extends React.Component<Props, State> implements ProgressListener {
  private readonly COLORS: string[] = [
    '#FFD484', '#FF7658', '#3294E4', '#50E3C2', '#8B572A', '#D7CB37', '#A749FA', '#3DD33E', '#4455E8',
    '#DF8519', '#F44A8B', '#E53737', '#A227BB', '#2D9D5C', '#D2FF84',
  ];

  @lazyInject(Services.TOKEN_MANAGER)
  private tokenManager: TokenManager;

  constructor(props: Props) {
    super(props);

    this.tokenManager.subscribeToProgress(this);

    this.state = {
      amount: 10000,
      arbiterCap: 0,
      arbiterProfit: 0,
      arbiterTotalTxFee: 0,
      arbitrationList: [],
      btcCount: 0,
      btcUSDT: 0,
      calculateMaxDateIndex: 1,
      calculateRangeDateIndex: [0, 1],
      cap: 0,
      changeWeightMinDateIndex: 1,
      commissionPercents: 0.2,
      historyChartRangeDateIndex: [0, 1],
      progressPercents: 0,
      proportionList: [],
      showCalculationProgress: false,
      tokenDialogDateList: [],
      tokenDialogOpen: false,
      tokenLatestWeights: new Map(),
      tokenNames: new Map(),
      tokensDate: [],
      tokensHistory: new Map(),
      tokensLegend: [],
      tokensWeightEditItem: undefined,
      tokensWeightList: [],
    };
  }

  public onProgress(percents: number): void {
    if (!this.state.showCalculationProgress) {
      this.setState({showCalculationProgress: true});
    }

    this.setState({progressPercents: percents});
  }

  public componentDidMount(): void {
    if (this.tokenManager.getPriceHistory().size === 0) {
      // Redirect to root
      // window.location.replace('/arbitrator-simulator');
    }

    this.tokenManager
      .getAvailableTokens()
      .then(this.onSyncTokens.bind(this))
      .catch(reason => alert(reason.message));
  }

  public render() {
    return (
      <Layout
        style={{
          background: '#f5f8fa',
          minHeight: '100vh',
        }}
      >
        <PageHeader/>
        <header className="CalculatorPage__header">
          Options
        </header>
        <div className="CalculatorPage__content">
          <PageContent className="CalculatorPage__content-left">
            <div className="CalculatorPage__options-title">Amount of money:&nbsp;</div>
            <InputNumber
              value={this.state.amount}
              formatter={value => `$ ${value || '0'}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
              parser={value => parseInt((value || '0').replace(/\$\s?|(,*)/g, ''), 10)}
              onChange={value => this.onAmountChange(value)}
              style={{width: '100%'}}
            />

            <div className="CalculatorPage__options-title">Commission percents:&nbsp;</div>
            <InputNumber
              value={this.state.commissionPercents}
              step={0.01}
              formatter={value => `${value || '0'}%`}
              parser={value => parseFloat((value || '0').replace('%', ''))}
              max={99.99}
              min={0.01}
              onChange={value => this.onFeeChange(value)}
              style={{width: '100%'}}
            />

            <div>
              <div className="CalculatorPage__options-title">
                Period of date:
              </div>
              <div
                style={{
                  marginBottom: '30px',
                  width: '100%',
                }}
              >
                <Slider
                  step={1}
                  range={true}
                  disabled={this.state.tokensWeightList.length > 0}
                  max={this.state.calculateMaxDateIndex}
                  min={0}
                  tipFormatter={value => this.inputRangeTrackValue(value)}
                  value={this.state.calculateRangeDateIndex}
                  onChange={value => this.setState({calculateRangeDateIndex: value})}
                  onAfterChange={(value: SliderValue) => {
                    this.setState({historyChartRangeDateIndex: this.state.calculateRangeDateIndex});
                    this.tokenManager.changeCalculationDate(value[0], value[1]);
                  }}
                />
              </div>
            </div>

            <TokensProportionsList
              data={this.state.proportionList}
              disabled={this.state.tokensWeightList.length > 0}
              onChangeProportion={
                (name, value, position) => this.onChangeProportion(name, value, position)
              }
            />
          </PageContent>
          <PageContent className="CalculatorPage__content-right-top">
            <div className="CalculatorPage__options-title">Token weights:</div>
            <div className="CalculatorPage__content-left-chart">
              <Row
                className="CalculatorPage__content-left-chart-text"
                type="flex"
                justify="space-around"
                align="middle"
              >
                <Col>
                  Multitoken
                </Col>
              </Row>
              <ProportionChart
                type={ChartType.PIPE}
                aspect={1}
                data={this.state.proportionList}
                colors={this.COLORS}
              />
            </div>
            <div style={{float: 'left', width: '200px'}}>
              <TokensLegendList
                data={this.state.tokensLegend}
              />
            </div>
          </PageContent>
          <PageContent className="CalculatorPage__content-right-bottom">
            <div className="CalculatorPage__options-title">Tokens weight:</div>
            <div className="CalculatorPage__result-chart">
              <div style={{marginLeft: '-43px'}}>
                <WeightChart
                  applyScale={false}
                  data={this.state.tokensWeightList}
                  colors={this.COLORS}
                  initialDate={this.state.tokensDate[this.state.calculateRangeDateIndex[0]]}
                  initialState={this.state.proportionList}
                  finishDate={this.state.tokensDate[this.state.calculateRangeDateIndex[1]]}
                  showRange={false}
                  type={ChartType.BAR}
                />
              </div>
              <div style={{marginLeft: '20px', marginTop: '40px'}}>
                <TokenWeightList
                  maxHeight="200px"
                  onAddClick={() => this.onChangeTokenExchangeWeightClick(-1)}
                  onEditClick={(model, position) => this.onChangeTokenExchangeWeightClick(position, model)}
                  onDeleteClick={(model, position) => this.onDeleteTokenWeightClick(position)}
                  data={this.state.tokensWeightList}
                />
              </div>
            </div>
          </PageContent>

          <div className="CalculatorPage__content-calculate">
            <Button
              type="primary"
              size="large"
              onClick={() => this.onCalculateClick()}
            >
              Calculate
            </Button>
          </div>
        </div>

        <TokenWeightDialog
          onOkClick={(tokenWeight, oldModel) => this.onTokenDialogOkClick(tokenWeight, oldModel)}
          onCancel={() => this.setState({tokenDialogOpen: false})}
          openDialog={this.state.tokenDialogOpen}
          tokenWeights={this.state.tokenLatestWeights}
          editTokenWeights={this.state.tokensWeightEditItem}
          maxWeight={10}
          minDateIndex={this.state.changeWeightMinDateIndex}
          tokenNames={Array.from(this.tokenManager.getPriceHistory().keys())}
          dateList={this.state.tokensDate}
        />

      </Layout>
    );
  }

  private onChangeTokenExchangeWeightClick(position: number, model?: TokenWeight): void {
    const latestTokensWeight: Map<string, number> = new Map();
    const len: number = model ? this.state.tokensWeightList.length - 1 : this.state.tokensWeightList.length;

    for (let i = 0; i < len; i++) {
      const tokenPair = this.state.tokensWeightList[i].tokens;
      tokenPair.toArray().forEach((value2: Token) => {
        latestTokensWeight.set(value2.name, value2.weight);
      });
    }

    this.state.proportionList.forEach(value => {
      if (!latestTokensWeight.has(value.name)) {
        latestTokensWeight.set(value.name, value.weight);
      }
    });

    const weightList: TokenWeight[] = this.state.tokensWeightList;
    const minDateIndex: number = weightList.length > 0
      ? weightList[weightList.length - 1].index
      : this.state.calculateRangeDateIndex[0];

    this.setState({
      changeWeightMinDateIndex: model ? model.index : minDateIndex + 1,
      tokenDialogOpen: true,
      tokenLatestWeights: latestTokensWeight,
      tokensWeightEditItem: model,
    });
  }

  private onDeleteTokenWeightClick(position: number): void {
    const list: TokenWeight [] = this.state.tokensWeightList.slice(0, this.state.tokensWeightList.length);

    list.splice(position, 1);

    this.setState({tokensWeightList: list});
  }

  private onTokenDialogOkClick(model: TokenWeight, oldModel: TokenWeight | undefined) {
    this.setState({tokenDialogOpen: false});
    const list: TokenWeight [] = this.state.tokensWeightList.slice(0, this.state.tokensWeightList.length);
    if (oldModel === undefined) {
      list.push(model);

    } else {
      list.splice(list.indexOf(oldModel), 1, model);
    }

    list.sort((a, b) => a.timestamp - b.timestamp);

    this.setState({tokensWeightList: list});
  }

  private inputRangeTrackValue(value: number): string {
    if (value > -1 && value <= this.state.tokensDate.length - 1) {
      return DateUtils.toStringDate(this.state.tokensDate[value], DateUtils.DATE_FORMAT_SHORT);
    } else {
      return 'wrong date';
    }
  }

  private onChangeProportion(name: string, value: number, position: number) {
    const result: TokenProportion[] = this.state.proportionList.slice(0, this.state.proportionList.length);
    result[position].weight = value;
    this.setState({proportionList: result});
  }

  private onSyncTokens(tokens: Map<string, string>) {
    const tokenItems: Map<string, boolean> = new Map();
    const proportions: TokenProportion[] = [];

    tokens.forEach((value, key) => tokenItems.set(key, false));

    this.tokenManager.getPriceHistory().forEach((value, key) => {
      proportions.push(new TokenProportion(key, 10, 1, 10));
    });
    const firstTokenName: string = Array.from(this.tokenManager.getPriceHistory().keys())[0];
    const history: TokenPriceHistory[] = this.tokenManager.getPriceHistory().get(firstTokenName) || [];

    this.setState({tokensDate: history.map(value => value.time)});

    const maxIndex: number = this.tokenManager.getMaxCalculationIndex() - 1;
    this.setState({
      calculateMaxDateIndex: maxIndex || 0,
      calculateRangeDateIndex: [0, maxIndex || 0],
      historyChartRangeDateIndex: [0, maxIndex || 0]
    });

    this.setState({
      proportionList: proportions,
      tokenNames: tokenItems,
      tokensHistory: this.tokenManager.getPriceHistory(),
      tokensLegend: proportions.map((value, i) => new TokenLegend(value.name, this.COLORS[i])),
    });
  }

  private onAmountChange(value: number | string | undefined) {
    const valueNumber = Number(value);

    if (valueNumber > 0) {
      this.setState({amount: valueNumber});
    }
  }

  private onFeeChange(value: number | string | undefined) {
    const valueNumber = Math.max(0.01, Math.min(99.99, Number(value)));

    if (valueNumber > 0) {
      this.setState({commissionPercents: valueNumber});
    }
  }

  private onCalculateClick() {
    const mapProportions: Map<string, number> = new Map();

    this.state.proportionList.forEach(value => {
      mapProportions.set(value.name, value.weight);
    });

    this.tokenManager.changeProportions(mapProportions);

    this.applyTimelineProportions();
    this.tokenManager.setCommission(this.state.commissionPercents);
    this.tokenManager.setAmount(this.state.amount);
    const {history} = this.props;
    history.push('calculator/result');
  }

  private applyTimelineProportions(): void {
    const result: Map<number, Pair<Token, Token>> = new Map();

    this.state.tokensWeightList.forEach(weights => {
      result.set(weights.index, weights.tokens);
    });

    this.tokenManager.setExchangeWeights(result);
  }

}
