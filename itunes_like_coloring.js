( function( global ) {

   // FileオブジェクトからRGBを読み込む
   function loadRgb( file, size, callback ) {

      // 画像を読み込む
      var img    = new Image( );
      img.src    = window.URL.createObjectURL( file );
      img.onload = function( ) {

         // 読み込んだら指定サイズのcanvasに描画 
         var w  = img.width, h = img.height;

         var cw = w > h ? size : Math.ceil( size *  ( w / h ) );
         var ch = h > w ? size : Math.ceil( size *  ( h / w ) );

         var canvas = document.createElement( 'canvas' );
         canvas.setAttribute( 'width', cw );
         canvas.setAttribute( 'height', ch );

         var ctx = canvas.getContext( '2d' );
         ctx.drawImage(
            img,
            0, 0, w, h,
            0, 0, cw, ch
         );

         // 縮小された画像データを読み込んでRGBの配列をコールバックに渡す
         var data = ctx.getImageData( 0, 0, cw, ch ).data;
         var len  = data.length;

         result = [ ];
         for( var i = 0; i < len; i += 4 ) {
            result.push( {
               r: data[ i ],
               g: data[ i + 1 ],
               b: data[ i + 2 ]
            } );
         }
        
         callback( result );
      };
   }

   // RGBの集合からボーダー部分を抜き出す
   function cropBorder( width, rgbArray, callback ) {
      // 行毎に切り出す 
      var row = [ ];
      while( rgbArray.length > 0 ) {
         row.push( rgbArray.splice( 0, width ) );
      }

      var border = row.pop( ).concat( row.shift( ) ); // 先頭末尾がボーダーなのは当たり前
      var len    = border.length;
      border.concat( new Array( row.length * 2 ) ); // サイズは分かっているので予め確保

      for( var i = 0; i < row.length; i++ ) {
         // 各行の先頭末尾1pxがボーダー
         border[ len++ ] = row[ i ].pop( ); 
         border[ len++ ] = row[ i ].shift( );
      }

      // タプル欲しい
      callback( border, Array.prototype.concat.apply( [ ], row ) ); // rowに残った部分はボーダー以外
   }

   // RGBからYUVへ変換
   function toYuv( rgb ) {
      var r = rgb.r, g = rgb.g, b = rgb.b;
      return {
         y: r * 0.257 + g * 0.504 + b * 0.098 + 16,
         u: r * -0.148 + g * -0.291 + b * 0.439 + 128,
         v: r * 0.439 + g * -0.368 + b * -0.071 + 128
      };
   }

   // YUVからRGBへ変換
   function toRgb( yuv ) {
      var y = yuv.y - 16, u = yuv.u - 128, v = yuv.v - 128;
      return {
         r: round( y * 1.164 + v * 1.596 ),
         g: round( y * 1.164 + u * -0.391 + v * -0.813 ),
         b: round( y * 1.164 + u * 2.018 )
      };
   }

   // 丸め
   function round( rgbValue ) {
      var value = Math.round( rgbValue );
      return value < 255 ? value : 255;
   };

   // 指定距離以内のYUVを配列にまとめる
   function gatherYuv( yuvArray, threshold ) {
      var sets = [ ];
      var yuv  = null;

      while( yuv = yuvArray.shift( ) ) {
         var set = [ yuv ];
         for( var j = 0; j < yuvArray.length; j++ ) {
            if( calcYuvDistance( yuv, yuvArray[ j ] ) < threshold ) {
               set.push( yuvArray.splice( j--, 1 )[ 0 ] );
            }
         }
         sets.push( set );
      }

      return sets;
   }

   // YUV配列の平均を計算する
   function avgYuv( yuvArray ) {
      var y = 0, u = 0, v = 0;
      for( var i = 0; i < yuvArray.length; i++ ) {
         y += yuvArray[ i ].y;
         u += yuvArray[ i ].u;
         v += yuvArray[ i ].v;
      }
      
      return {
         y: y / yuvArray.length,
         u: u / yuvArray.length,
         v: v / yuvArray.length
      };
   }

   // YUV2点間の距離を求める
   function calcYuvDistance( a, b ) {
      return Math.sqrt(
         Math.pow( a.y - b.y, 2 ) +
         Math.pow( a.u - b.u, 2 ) +
         Math.pow( a.v - b.v, 2 )
      );
   }

   // ドミナントカラーを求める
   function calcDominantColor( rgbArray, n, threshold, numThreshold, filterColor, filterThreshold ) {

      // YUVのまとめあげ
      var sets  = gatherYuv( rgbArray.map( toYuv ), threshold );
      sets.sort( function( a, b ) {
         return b.length - a.length; // サイズで降順ソート
      } );

      var yuvs = sets.map( avgYuv ); // 平均を計算しておく

      // filterColorよりfilterThresholdだけ離れているYUVだけを抽出対象とする
      if( filterColor ) {
         yuvs = yuvs.filter( function( yuv ) {
            return calcYuvDistance( yuv, this ) > filterThreshold;
         }, toYuv( filterColor ) );
      }

      if( yuvs.length == 0 ) {
         return [ ]
      }

      var results = [ ], prev = yuvs.shift( );

      while( yuvs.length > 0 && results.length < n ) {
         var next = yuvs.shift( );
         if( calcYuvDistance( prev, next ) > numThreshold ) {
            results.push( prev );
            prev = next;
        }
      }

      if( results.length < n ) {
         results.push( prev );
      }
      return results.map( toRgb );
   }

   global.iTunesLikeColoring = {
      loadRgb: loadRgb,
      cropBorder: cropBorder,
      calcDominantColor: calcDominantColor,
   };

} )( this );

